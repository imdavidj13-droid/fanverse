import { body, HttpError, json, text, limit, pageCursor } from './http';
import { throttle, visiblePost, type ProfileRow } from './security';
import { resolveFandom } from './catalogue';
import type { Env } from './types';
const parse = (v: unknown, fallback: unknown = {}) => { try {
    return JSON.parse(String(v));
}
catch {
    return fallback;
} };
function image(v: unknown) { if (v == null || v === '')
    return ''; if (typeof v !== 'string' || v.length > 550000 || !/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(v))
    throw new HttpError(400, 'Choose a PNG, JPEG or WebP image smaller than 400 KB.'); return v; }
const visible = `p.status='published' AND a.status='active' AND f.status='active' AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=p.user_id) OR (b.user_id=p.user_id AND b.blocked_id=?))`;
export async function cloud(request: Request, env: Env, person: ProfileRow | null): Promise<Response> {
    if (!person)
        throw new HttpError(401, 'Please sign in.');
    const db = env.DB!, uid = person.user_id, url = new URL(request.url), path = url.pathname.slice('/api/cloud'.length), method = request.method;
    if (!['GET', 'HEAD'].includes(method))
        await throttle(env, person);
    if (path === '/bootstrap' && method === 'GET') {
        const [details, memberships, fandoms, collections, hidden, mutes] = await Promise.all([
            db.prepare('SELECT * FROM profile_details WHERE user_id=?').bind(uid).first(),
            db.prepare('SELECT fandom_id FROM fandom_memberships WHERE user_id=?').bind(uid).all(),
            db.prepare("SELECT f.id,f.slug,f.name,f.description,f.kind,(SELECT COUNT(*) FROM fandom_memberships m JOIN profiles p ON p.user_id=m.user_id WHERE m.fandom_id=f.id AND p.status='active') members FROM fandoms f WHERE status='active' ORDER BY EXISTS(SELECT 1 FROM fandom_memberships m WHERE m.user_id=? AND m.fandom_id=f.id) DESC,name LIMIT 200").bind(uid).all(),
            db.prepare('SELECT id,name FROM bookmark_collections WHERE user_id=? ORDER BY name').bind(uid).all(),
            db.prepare('SELECT fandom_id FROM hidden_fandoms WHERE user_id=?').bind(uid).all(),
            db.prepare('SELECT p.user_id,p.username FROM account_mutes m JOIN profiles p ON p.user_id=m.muted_id WHERE m.user_id=?').bind(uid).all()
        ]);
        return json({ profile: { ...person, avatar: details?.avatar || '' }, theme: parse(details?.theme), preferences: parse(details?.preferences), revision: details?.revision || 0, memberships: memberships.results.map(r => r.fandom_id), fandoms: fandoms.results, collections: collections.results, hiddenFandoms: hidden.results.map(r => r.fandom_id), mutes: mutes.results });
    }
    if (path === '/profile' && method === 'PUT') {
        const v = await body(request, 1200000), name = text(v.name, 'Name', 40), bio = text(v.bio || '', 'Bio', 180, false), avatar = image(v.avatar);
        const theme = v.theme && typeof v.theme === 'object' && !Array.isArray(v.theme) ? v.theme as Record<string, unknown> : {};
        const prefs = v.preferences && typeof v.preferences === 'object' && !Array.isArray(v.preferences) ? v.preferences as Record<string, unknown> : {};
        const cleanTheme: Record<string, unknown> = {};
        for (const key of ['css', 'layout', 'pattern', 'tagline', 'song', 'album', 'quote'])
            if (typeof theme[key] === 'string')
                cleanTheme[key] = String(theme[key]).slice(0, key === 'css' ? 6000 : 500);
        cleanTheme.coverImage = image(theme.coverImage);
        for (const key of ['showFandoms', 'showStats'])
            cleanTheme[key] = Boolean(theme[key]);
        cleanTheme.pinnedPostId = null;
        if (Number.isSafeInteger(theme.pinnedPostId) && await db.prepare("SELECT id FROM posts WHERE id=? AND user_id=? AND status='published'").bind(theme.pinnedPostId, uid).first())
            cleanTheme.pinnedPostId = theme.pinnedPostId;
        const cleanPrefs = { compact: Boolean(prefs.compact), largeText: Boolean(prefs.largeText), hideSpoilers: prefs.hideSpoilers !== false, recordActivity: prefs.recordActivity !== false, mutedWords: Array.isArray(prefs.mutedWords) ? prefs.mutedWords.filter(w => typeof w === 'string').slice(0, 50).map(w => w.slice(0, 60)) : [] };
        // One row revision guards edits from another tab/device; no last-writer overwrite.
        await db.prepare('INSERT OR IGNORE INTO profile_details(user_id) VALUES(?)').bind(uid).run();
        const username = text(v.username ?? person.username, 'Username', 24).toLowerCase();
        if (!/^[a-z0-9_]{3,24}$/.test(username) || ['admin', 'administrator', 'support', 'moderator', 'fanverse', 'settings', 'api'].includes(username))
            throw new HttpError(400, 'Choose a valid username: 3–24 letters, numbers or underscores.');
        let result;
        try {
            result = await db.batch([
                db.prepare('UPDATE profiles SET display_name=?,bio=?,username=? WHERE user_id=? AND (SELECT revision FROM profile_details WHERE user_id=?)=?').bind(name, bio, username, uid, uid, Number(v.revision) || 0),
                db.prepare('UPDATE profile_details SET avatar=?,theme=?,preferences=?,revision=revision+1 WHERE user_id=? AND revision=? RETURNING revision').bind(avatar, JSON.stringify(cleanTheme), JSON.stringify(cleanPrefs), uid, Number(v.revision) || 0)
            ]);
        }
        catch (e) {
            if (String(e).includes('UNIQUE'))
                throw new HttpError(409, 'That username is taken.');
            throw e;
        }
        const updated = result[1].results[0] as {
            revision: number;
        } | undefined;
        if (!updated)
            throw new HttpError(409, 'Your profile changed on another device. Reload before saving again.');
        return json({ ok: true, revision: updated.revision });
    }
    if (path === '/feed' && method === 'GET') {
        const feed = url.searchParams.get('feed') || 'latest', fandom = url.searchParams.get('fandom'), author = url.searchParams.get('author') || (feed === 'reposts' ? person.username : null), collection = url.searchParams.get('collection'), q = (url.searchParams.get('q') || '').slice(0, 100).toLowerCase(), n = limit(url), before = pageCursor(url);
        if (!['latest', 'following', 'fandoms', 'bookmarks', 'reposts', 'media', 'polls'].includes(feed))
            throw new HttpError(400, 'Unknown feed.');
        const filterFandom = fandom ? (await resolveFandom(db, fandom)).id : null;
        const rows = await db.prepare(`SELECT p.*,a.username,a.display_name,f.name fandom_name,f.slug fandom_slug,COALESCE(d.image,'') image,COALESCE(d.image_alt,'') image_alt,COALESCE(d.poll,'[]') poll,COALESCE(d.spoiler,0) spoiler,COALESCE(pd.avatar,'') avatar,
   (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) likes,(SELECT COUNT(*) FROM replies r JOIN profiles ra ON ra.user_id=r.user_id WHERE r.post_id=p.id AND r.status='published' AND ra.status='active' AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=r.user_id) OR (b.user_id=r.user_id AND b.blocked_id=?))) replies,
   (SELECT COUNT(*) FROM post_reposts r WHERE r.post_id=p.id) reposts,
   EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.user_id=?) liked,EXISTS(SELECT 1 FROM post_bookmarks b WHERE b.post_id=p.id AND b.user_id=?) bookmarked,EXISTS(SELECT 1 FROM post_reposts r WHERE r.post_id=p.id AND r.user_id=?) reposted,
   (SELECT choice FROM poll_votes v WHERE v.post_id=p.id AND v.user_id=?) vote
   FROM posts p JOIN profiles a ON a.user_id=p.user_id JOIN fandoms f ON f.id=p.fandom_id LEFT JOIN post_details d ON d.post_id=p.id LEFT JOIN profile_details pd ON pd.user_id=p.user_id
   WHERE ${visible} AND p.id<? AND (? IS NULL OR p.fandom_id=?) AND (? IS NULL OR (?!='reposts' AND a.username=?) OR (?='reposts' AND EXISTS(SELECT 1 FROM post_reposts pr JOIN profiles pp ON pp.user_id=pr.user_id WHERE pr.post_id=p.id AND pp.username=?)))
   AND (?!='following' OR p.user_id=? OR EXISTS(SELECT 1 FROM follows fo WHERE fo.user_id=? AND fo.following_id=p.user_id))
   AND (?!='fandoms' OR EXISTS(SELECT 1 FROM fandom_memberships m WHERE m.user_id=? AND m.fandom_id=p.fandom_id))
   AND (?!='bookmarks' OR EXISTS(SELECT 1 FROM post_bookmarks b WHERE b.user_id=? AND b.post_id=p.id))
   AND (? IS NULL OR EXISTS(SELECT 1 FROM bookmark_folders bf JOIN bookmark_collections bc ON bc.id=bf.collection_id WHERE bf.user_id=? AND bf.post_id=p.id AND bc.id=? AND bc.user_id=?))
   AND (?!='media' OR length(d.image)>0) AND (?!='polls' OR d.poll!='[]') AND (?='' OR instr(lower(p.text || ' ' || a.username || ' ' || a.display_name),?)>0)
   AND NOT EXISTS(SELECT 1 FROM account_mutes am WHERE am.user_id=? AND am.muted_id=p.user_id)
   ORDER BY p.id DESC LIMIT ?`).bind(uid, uid, uid, uid, uid, uid, uid, uid, before, filterFandom, filterFandom, author, feed, author, feed, author, feed, uid, uid, feed, uid, feed, uid, collection, uid, collection, uid, feed, feed, q, q, uid, n + 1).all();
        const items = rows.results.slice(0, n);
        for (const row of items) {
            row.poll = parse(row.poll, []);
            row.pollCounts = Array.isArray(row.poll) && row.poll.length ? (await db.prepare('SELECT choice,COUNT(*) count FROM poll_votes WHERE post_id=? GROUP BY choice').bind(row.id).all()).results : [];
        }
        return json({ items, next: rows.results.length > n ? items[n - 1].id : null });
    }
    if (path === '/posts' && method === 'POST') {
        const v = await body(request, 600000), content = text(v.text || '', 'Post', 500, false), pic = image(v.image), alt = text(v.imageAlt || '', 'Image description', 300, false), fandom = (await resolveFandom(db, text(v.fandom, 'Fandom', 100))).id;
        const poll = Array.isArray(v.poll) ? v.poll.map(s => text(s, 'Poll option', 100)) : [];
        if (!content && !pic)
            throw new HttpError(400, 'Write something or add a photo.');
        if (poll.length && (poll.length < 2 || poll.length > 4 || new Set(poll).size !== poll.length))
            throw new HttpError(400, 'Add 2–4 different poll options.');
        const result = await db.prepare('INSERT INTO posts(user_id,fandom_id,text) VALUES(?,?,?) RETURNING id').bind(uid, fandom, content || '📷').first<{
            id: number;
        }>();
        await db.prepare('INSERT INTO post_details(post_id,image,image_alt,poll,spoiler) VALUES(?,?,?,?,?)').bind(result!.id, pic, alt, JSON.stringify(poll), Number(Boolean(v.spoiler))).run();
        await db.prepare('DELETE FROM cloud_drafts WHERE user_id=? AND context=?').bind(uid, String(v.context || 'main').slice(0, 100)).run();
        return json({ id: result!.id }, 201);
    }
    const post = path.match(/^\/posts\/(\d+)(?:\/(vote|repost|collection))?$/);
    if (post) {
        const id = Number(post[1]), kind = post[2];
        await visiblePost(env, id, uid);
        if (!kind && method === 'GET') {
            const row = await db.prepare(`SELECT p.*,a.username,a.display_name,f.name fandom_name,COALESCE(d.image,'') image,COALESCE(d.image_alt,'') image_alt,COALESCE(d.poll,'[]') poll,COALESCE(pd.avatar,'') avatar,
  (SELECT COUNT(*) FROM post_likes WHERE post_id=p.id) likes,(SELECT COUNT(*) FROM replies WHERE post_id=p.id AND status='published') replies,(SELECT COUNT(*) FROM post_reposts WHERE post_id=p.id) reposts,
  EXISTS(SELECT 1 FROM post_likes WHERE post_id=p.id AND user_id=?) liked,EXISTS(SELECT 1 FROM post_bookmarks WHERE post_id=p.id AND user_id=?) bookmarked,EXISTS(SELECT 1 FROM post_reposts WHERE post_id=p.id AND user_id=?) reposted,(SELECT choice FROM poll_votes WHERE post_id=p.id AND user_id=?) vote,COALESCE(d.spoiler,0) spoiler FROM posts p JOIN profiles a ON a.user_id=p.user_id JOIN fandoms f ON f.id=p.fandom_id LEFT JOIN post_details d ON d.post_id=p.id LEFT JOIN profile_details pd ON pd.user_id=p.user_id WHERE p.id=?`).bind(uid, uid, uid, uid, id).first();
            const counts = await db.prepare('SELECT choice,COUNT(*) count FROM poll_votes WHERE post_id=? GROUP BY choice').bind(id).all();
            return json({ post: { ...row, poll: parse(row?.poll, []), pollCounts: counts.results } });
        }
        if (kind === 'vote' && method === 'PUT') {
            const v = await body(request), d = await db.prepare('SELECT poll FROM post_details WHERE post_id=?').bind(id).first(), opts = parse(d?.poll, []) as unknown[];
            if (!Number.isInteger(v.choice) || Number(v.choice) < 0 || Number(v.choice) >= opts.length)
                throw new HttpError(400, 'Choose a poll option.');
            await db.prepare('INSERT INTO poll_votes(user_id,post_id,choice) VALUES(?,?,?) ON CONFLICT(user_id,post_id) DO UPDATE SET choice=excluded.choice').bind(uid, id, v.choice).run();
            return json({ ok: true });
        }
        if (kind === 'repost' && ['PUT', 'DELETE'].includes(method)) {
            await db.prepare(method === 'PUT' ? 'INSERT OR IGNORE INTO post_reposts(user_id,post_id) VALUES(?,?)' : 'DELETE FROM post_reposts WHERE user_id=? AND post_id=?').bind(uid, id).run();
            return json({ ok: true });
        }
        if (kind === 'collection' && method === 'PUT') {
            const v = await body(request);
            if (v.collection && !await db.prepare('SELECT id FROM bookmark_collections WHERE id=? AND user_id=?').bind(v.collection, uid).first())
                throw new HttpError(404, 'Collection not found.');
            await db.batch([db.prepare('INSERT OR IGNORE INTO post_bookmarks(user_id,post_id) VALUES(?,?)').bind(uid, id), v.collection ? db.prepare('INSERT INTO bookmark_folders(user_id,post_id,collection_id) VALUES(?,?,?) ON CONFLICT(user_id,post_id) DO UPDATE SET collection_id=excluded.collection_id').bind(uid, id, v.collection) : db.prepare('DELETE FROM bookmark_folders WHERE user_id=? AND post_id=?').bind(uid, id)]);
            return json({ ok: true });
        }
    }
    if (path === '/collections' && method === 'POST') {
        const v = await body(request), name = text(v.name, 'Collection name', 40), id = crypto.randomUUID();
        try {
            await db.prepare('INSERT INTO bookmark_collections(id,user_id,name) VALUES(?,?,?)').bind(id, uid, name).run();
        }
        catch (e) {
            if (String(e).includes('UNIQUE'))
                throw new HttpError(409, 'You already have a collection with that name.');
            throw e;
        }
        return json({ id, name }, 201);
    }
    const collection = path.match(/^\/collections\/([a-f0-9-]+)$/);
    if (collection && ['PATCH', 'DELETE'].includes(method)) {
        if (method === 'DELETE')
            await db.prepare('DELETE FROM bookmark_collections WHERE id=? AND user_id=?').bind(collection[1], uid).run();
        else {
            const v = await body(request);
            await db.prepare('UPDATE bookmark_collections SET name=? WHERE id=? AND user_id=?').bind(text(v.name, 'Name', 40), collection[1], uid).run();
        }
        return json({ ok: true });
    }
    if (path === '/draft' && method === 'GET') {
        const row = await db.prepare('SELECT content FROM cloud_drafts WHERE user_id=? AND context=?').bind(uid, (url.searchParams.get('context') || 'main').slice(0, 100)).first();
        return json({ draft: parse(row?.content, null) });
    }
    if (path === '/draft' && method === 'PUT') {
        const v = await body(request, 600000), context = text(v.context || 'main', 'Context', 100), d = v.draft as Record<string, unknown>;
        if (!d || typeof d !== 'object')
            throw new HttpError(400, 'Invalid draft.');
        const content = { text: text(d.text || '', 'Draft', 500, false), fandom: text(d.fandom || '', 'Fandom', 100, false), image: image(d.image), imageAlt: text(d.imageAlt || '', 'Description', 300, false), poll: Array.isArray(d.poll) ? d.poll.slice(0, 4).map(s => text(s, 'Option', 100, false)) : [], spoiler: Boolean(d.spoiler) };
        await db.prepare("INSERT INTO cloud_drafts(user_id,context,content) VALUES(?,?,?) ON CONFLICT(user_id,context) DO UPDATE SET content=excluded.content,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(uid, context, JSON.stringify(content)).run();
        return json({ ok: true });
    }
    if (path === '/draft' && method === 'DELETE') {
        await db.prepare('DELETE FROM cloud_drafts WHERE user_id=? AND context=?').bind(uid, (url.searchParams.get('context') || 'main').slice(0, 100)).run();
        return json({ ok: true });
    }
    const fan = path.match(/^\/fans\/([a-zA-Z0-9_]+)$/);
    if (fan && method === 'GET') {
        const row = await db.prepare(`SELECT a.user_id,a.username,a.display_name,a.bio,COALESCE(d.avatar,'') avatar,COALESCE(d.theme,'{}') theme,(SELECT COUNT(*) FROM follows WHERE following_id=a.user_id) followers,(SELECT COUNT(*) FROM follows WHERE user_id=a.user_id) following_count,EXISTS(SELECT 1 FROM follows WHERE user_id=? AND following_id=a.user_id) following,EXISTS(SELECT 1 FROM account_mutes WHERE user_id=? AND muted_id=a.user_id) muted,EXISTS(SELECT 1 FROM blocks WHERE user_id=? AND blocked_id=a.user_id) blocked FROM profiles a LEFT JOIN profile_details d ON d.user_id=a.user_id WHERE a.username=? COLLATE NOCASE AND a.status='active' AND NOT EXISTS(SELECT 1 FROM blocks WHERE user_id=a.user_id AND blocked_id=?)`).bind(uid, uid, uid, fan[1], uid).first();
        if (!row)
            throw new HttpError(404, 'Profile not found.');
        return json({ profile: { ...row, theme: parse(row.theme) } });
    }
    const mute = path.match(/^\/mutes\/([^/]+)$/);
    if (mute && ['PUT', 'DELETE'].includes(method)) {
        if (mute[1] === uid)
            throw new HttpError(400, 'Choose another account.');
        await db.prepare(method === 'PUT' ? 'INSERT OR IGNORE INTO account_mutes(user_id,muted_id) SELECT ?,user_id FROM profiles WHERE user_id=?' : 'DELETE FROM account_mutes WHERE user_id=? AND muted_id=?').bind(uid, mute[1]).run();
        return json({ ok: true });
    }
    const hidden = path.match(/^\/hidden-fandoms\/([a-zA-Z0-9_-]+)$/);
    if (hidden && ['PUT', 'DELETE'].includes(method)) {
        const fandom = (await resolveFandom(db, hidden[1])).id;
        await db.prepare(method === 'PUT' ? 'INSERT OR IGNORE INTO hidden_fandoms(user_id,fandom_id) VALUES(?,?)' : 'DELETE FROM hidden_fandoms WHERE user_id=? AND fandom_id=?').bind(uid, fandom).run();
        return json({ ok: true });
    }
    if (path === '/notifications' && method === 'GET') {
        const rows = await db.prepare(`SELECT n.id,n.kind,n.post_id,n.created_at,n.read_at,a.username,a.display_name FROM notifications n JOIN profiles a ON a.user_id=n.actor_id WHERE n.user_id=? AND a.status='active' AND n.id<? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=n.actor_id) OR (b.user_id=n.actor_id AND b.blocked_id=?)) ORDER BY n.id DESC LIMIT ?`).bind(uid, pageCursor(url), uid, uid, limit(url) + 1).all();
        const n = limit(url);
        return json({ items: rows.results.slice(0, n), next: rows.results.length > n ? rows.results[n - 1].id : null });
    }
    if (path === '/notifications/read' && method === 'PUT') {
        await db.prepare("UPDATE notifications SET read_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id=? AND read_at IS NULL").bind(uid).run();
        return json({ ok: true });
    }
    if (path === '/messages' && method === 'GET') {
        const target = url.searchParams.get('with'), n = limit(url);
        const rows = await db.prepare(`SELECT m.*,a.username sender_username,a.display_name sender_name,b.username recipient_username,b.display_name recipient_name FROM direct_messages m JOIN profiles a ON a.user_id=m.sender_id JOIN profiles b ON b.user_id=m.recipient_id WHERE (m.sender_id=? OR m.recipient_id=?) AND (? IS NULL OR (m.sender_id=? AND m.recipient_id=?) OR (m.recipient_id=? AND m.sender_id=?)) AND m.id<? AND a.status='active' AND b.status='active' AND NOT EXISTS(SELECT 1 FROM blocks bl WHERE (bl.user_id=m.sender_id AND bl.blocked_id=m.recipient_id) OR (bl.user_id=m.recipient_id AND bl.blocked_id=m.sender_id)) ORDER BY m.id DESC LIMIT ?`).bind(uid, uid, target, uid, target, uid, target, pageCursor(url), n + 1).all();
        return json({ items: rows.results.slice(0, n), next: rows.results.length > n ? rows.results[n - 1].id : null });
    }
    if (path === '/messages' && method === 'POST') {
        const v = await body(request), target = text(v.recipient, 'Recipient', 100), content = text(v.text, 'Message', 2000);
        if (target === uid)
            throw new HttpError(400, 'Choose another account.');
        if (!await db.prepare("SELECT user_id FROM profiles WHERE user_id=? AND status='active' AND NOT EXISTS(SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=?) OR (user_id=? AND blocked_id=?))").bind(target, uid, target, target, uid).first())
            throw new HttpError(404, 'This account is unavailable.');
        const result = await db.prepare('INSERT INTO direct_messages(sender_id,recipient_id,text) VALUES(?,?,?) RETURNING id').bind(uid, target, content).first();
        return json(result, 201);
    }
    if (path === '/messages/read' && method === 'PUT') {
        const v = await body(request);
        await db.prepare("UPDATE direct_messages SET read_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE recipient_id=? AND sender_id=? AND read_at IS NULL").bind(uid, String(v.sender || '')).run();
        return json({ ok: true });
    }
    if (path === '/events' && method === 'GET') {
        const fandom = url.searchParams.get('fandom'), id = fandom ? (await resolveFandom(db, fandom)).id : null;
        const rows = await db.prepare(`SELECT e.*,a.username,a.display_name,f.name fandom_name,(SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id=e.id) going,EXISTS(SELECT 1 FROM event_rsvps r WHERE r.event_id=e.id AND r.user_id=?) rsvp FROM fandom_events e JOIN profiles a ON a.user_id=e.user_id JOIN fandoms f ON f.id=e.fandom_id WHERE (? IS NULL OR e.fandom_id=?) AND e.id<? AND a.status='active' AND f.status='active' AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=e.user_id) OR (b.user_id=e.user_id AND b.blocked_id=?)) ORDER BY e.id DESC LIMIT ?`).bind(uid, id, id, pageCursor(url), uid, uid, limit(url) + 1).all();
        const n = limit(url);
        return json({ items: rows.results.slice(0, n), next: rows.results.length > n ? rows.results[n - 1].id : null });
    }
    if (path === '/events' && method === 'POST') {
        const v = await body(request), fandom = (await resolveFandom(db, text(v.fandom, 'Fandom', 100))).id, date = new Date(String(v.startsAt));
        if (!Number.isFinite(date.getTime()) || date.getTime() < Date.now())
            throw new HttpError(400, 'Choose a future date and time.');
        const result = await db.prepare('INSERT INTO fandom_events(user_id,fandom_id,title,starts_at,description) VALUES(?,?,?,?,?) RETURNING id').bind(uid, fandom, text(v.title, 'Title', 100), date.toISOString(), text(v.description || '', 'Description', 1000, false)).first();
        return json(result, 201);
    }
    const event = path.match(/^\/events\/(\d+)(?:\/(rsvp))?$/);
    if (event) {
        const row = await db.prepare(`SELECT e.* FROM fandom_events e JOIN profiles a ON a.user_id=e.user_id JOIN fandoms f ON f.id=e.fandom_id WHERE e.id=? AND a.status='active' AND f.status='active' AND NOT EXISTS(SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=e.user_id) OR (user_id=e.user_id AND blocked_id=?))`).bind(event[1], uid, uid).first();
        if (!row)
            throw new HttpError(404, 'Event not found.');
        if (event[2] && ['PUT', 'DELETE'].includes(method)) {
            if (row.status !== 'scheduled')
                throw new HttpError(409, 'This event is cancelled.');
            await db.prepare(method === 'PUT' ? 'INSERT OR IGNORE INTO event_rsvps(event_id,user_id) VALUES(?,?)' : 'DELETE FROM event_rsvps WHERE event_id=? AND user_id=?').bind(event[1], uid).run();
            return json({ ok: true });
        }
        if (!event[2] && method === 'DELETE') {
            if (row.user_id !== uid && person.role !== 'admin')
                throw new HttpError(403, 'Only the host can cancel this event.');
            await db.prepare("UPDATE fandom_events SET status='cancelled' WHERE id=?").bind(event[1]).run();
            return json({ ok: true });
        }
    }
    throw new HttpError(404, 'Page not found.');
}
