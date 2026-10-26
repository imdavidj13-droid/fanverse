import { useEffect, useState, useRef, type CSSProperties, type FormEvent } from 'react';
import { Home, Compass, Users, Bell, Mail, Bookmark, User, Settings, Headphones, Sparkles, Search, LogOut, Heart, MessageCircle, Repeat2, Plus } from 'lucide-react';
import { api, type LiveProfile, type Page } from './api';
import { useRoute, navigate } from './routes';
import { AppLink as Link } from './Navigation';
import { SignupLanding } from './SignupLanding';
import { Onboarding } from './Onboarding';
import { ProfileStudio } from './ProfileStudio';
import { defaultProfileStyle, parseThemeCss, type ProfileStyle } from './profileTheme';
import { defaultPreferences } from './activity';
import { freshState, type State } from './model';
import { CatalogueBrowser } from './CatalogueBrowser';
import { ListeningPartyBoard, ListeningPartyDetail, PartiesRail } from './ListeningParties';
import { AdminPanel } from './admin/AdminPanel';
import './styles.css';
import './cloud.css';
export type Directory = {
    id: string;
    slug: string;
    name: string;
    description: string;
    kind: string;
    members: number;
};
export type Boot = {
    profile: LiveProfile & {
        avatar: string;
    };
    theme: ProfileStyle;
    preferences: typeof defaultPreferences;
    revision: number;
    memberships: string[];
    hiddenFandoms: string[];
    mutes: {
        user_id: string;
        username: string;
    }[];
    fandoms: Directory[];
    collections: {
        id: string;
        name: string;
    }[];
};
export type CloudPost = {
    id: number;
    user_id: string;
    username: string;
    display_name: string;
    fandom_id: string;
    fandom_name: string;
    text: string;
    created_at: string;
    image: string;
    image_alt: string;
    avatar: string;
    poll: string[];
    pollCounts: {
        choice: number;
        count: number;
    }[];
    vote: number | null;
    likes: number;
    replies: number;
    reposts: number;
    liked: number;
    bookmarked: number;
    reposted: number;
    spoiler: number;
};
export function CloudApp() {
    const route = useRoute(), [boot, setBoot] = useState<Boot | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [onboarding, setOnboarding] = useState(false), [notice, setNotice] = useState(''), [revision, setRevision] = useState(0), [resolvedFandom, setResolvedFandom] = useState<Directory | null>(null), [fandomError, setFandomError] = useState('');
    async function load() { setError(''); try {
        const status = await api<{
            ready: boolean;
        }>('/api/status');
        if (!status.ready)
            throw Error('The account service is unavailable. Please try again shortly.');
        const me = await api<{
            profile: LiveProfile | null;
            onboardingCompleted: boolean;
        }>('/api/me');
        if (!me.profile) {
            setBoot(null);
            return;
        }
        setOnboarding(!me.onboardingCompleted);
        const data = await api<Boot>('/api/cloud/bootstrap');
        data.theme = { ...defaultProfileStyle, ...data.theme };
        data.preferences = { ...defaultPreferences, ...data.preferences };
        setBoot(data);
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setLoading(false);
    } }
    useEffect(() => { void load(); }, []);
    useEffect(() => { document.title = route.page + ' · Your fandoms'; }, [route.page]);
    useEffect(() => { if (boot) {
        document.documentElement.dataset.density = boot.preferences.compact ? 'compact' : 'comfortable';
        document.documentElement.dataset.text = boot.preferences.largeText ? 'large' : 'normal';
    } }, [boot?.preferences]);
    const fandomLookup = route.page === 'Catalogue fandom' ? location.pathname.split('/').pop() : route.fandom || route.sharedFandom;
    useEffect(() => { let active = true; setResolvedFandom(null); setFandomError(''); if (!fandomLookup || !boot)
        return; api<{
        fandom: Directory;
    }>('/api/fandoms/' + encodeURIComponent(fandomLookup)).then(v => { if (active)
        setResolvedFandom(v.fandom); }).catch(e => { if (active)
        setFandomError((e as Error).message); }); return () => { active = false; }; }, [fandomLookup, Boolean(boot)]);
    const refresh = async () => { await load(); setRevision(v => v + 1); };
    async function action(path: string, method = 'PUT', data?: unknown) { try {
        await api(path, method, data);
        await refresh();
    }
    catch (e) {
        setNotice((e as Error).message);
    } }
    async function saveProfile(next: Boot) { try {
        const result = await api<{
            revision: number;
        }>('/api/cloud/profile', 'PUT', { name: next.profile.display_name, username: next.profile.username, bio: next.profile.bio, avatar: next.profile.avatar, theme: next.theme, preferences: next.preferences, revision: boot!.revision });
        setBoot({ ...next, revision: result.revision });
        setNotice('Saved to your account.');
    }
    catch (e) {
        setNotice((e as Error).message);
        throw e;
    } }
    if (loading)
        return <main className="signup-screen"><section className="signup-card"><p role="status">Opening your account…</p></section></main>;
    if (error)
        return <main className="signup-screen"><section className="signup-card"><h1>We couldn’t connect</h1><p role="alert">{error}</p><button className="primary" onClick={() => { setLoading(true); void load(); }}>Try again</button><button onClick={async () => { await api('/api/auth/sign-out', 'POST', {}); location.reload(); }}>Sign out</button></section></main>;
    if (!boot)
        return <SignupLanding initialMode={route.page === 'Sign in' ? 'login' : 'signup'} onAuthenticated={() => { setLoading(true); void load(); }}/>;
    if (onboarding)
        return <Onboarding initialName={boot.profile.display_name} onComplete={() => { setOnboarding(false); void refresh(); navigate('/'); }}/>;
    const nav = [['Home', '/', Home], ['Explore', '/explore', Compass], ['My fandoms', '/fandoms', Users], ['Catalogue', '/catalogue', Compass], ['Listening parties', '/parties', Headphones], ['Notifications', '/notifications', Bell], ['Messages', '/messages', Mail], ['Bookmarks', '/bookmarks', Bookmark], ['Profile', '/profile', User], ['Settings', '/settings', Settings]] as const;
    const fandom = resolvedFandom || (boot.fandoms.find(f => f.id === fandomLookup || f.slug === fandomLookup));
    const params = new URLSearchParams(location.search), profileUsername = route.page === 'Fan' ? decodeURIComponent(location.pathname.split('/').pop()!) : boot.profile.username;
    let content;
    if (['Home', 'Explore', 'Community', 'Catalogue fandom'].includes(route.page))
        content = fandomLookup && !fandom ? <p className="cloud-empty" role={fandomError ? 'alert' : 'status'}>{fandomError || 'Opening fandom…'}</p> : <>{fandom && <div className="cloud-page-heading"><span>YOUR FANDOM</span><h1>{fandom.name}</h1><p>{fandom.description}</p><button className="primary" onClick={() => void action('/api/memberships/' + fandom.id, boot.memberships.includes(fandom.id) ? 'DELETE' : 'PUT')}>{boot.memberships.includes(fandom.id) ? 'Joined · Leave fandom' : 'Join fandom'}</button><div className="cloud-tabs"><Link href={location.pathname}>Discussions</Link><Link href={location.pathname + '?section=events'}>Events</Link><Link href={location.pathname + '?section=media'}>Media</Link></div></div>}{params.get('section') === 'events' ? <CloudEvents boot={boot} fandom={fandom?.id} notify={setNotice}/> : <CloudFeed key={location.pathname + location.search + revision} boot={boot} fandom={fandom?.id} refresh={refresh} notify={setNotice} discover={route.page === 'Explore'} initialFeed={params.get('section') === 'media' ? 'media' : undefined}/>}</>;
    else if (route.page === 'My fandoms')
        content = <div className="cloud-page-heading"><h1>Your fandoms</h1><p>Find your people. Every membership is saved to your account.</p><Link className="primary" href="/catalogue">Find a fandom</Link><div className="cloud-directory">{boot.fandoms.map(f => <article key={f.id}><Link href={'/fandoms/' + f.slug}><h2>{f.name}</h2></Link><p>{f.members} {f.members === 1 ? 'member' : 'members'}</p><button className={boot.memberships.includes(f.id) ? 'secondary' : 'primary'} onClick={() => void action('/api/memberships/' + f.id, boot.memberships.includes(f.id) ? 'DELETE' : 'PUT')}>{boot.memberships.includes(f.id) ? 'Joined · Leave' : 'Join'}</button></article>)}</div></div>;
    else if (route.page === 'Catalogue')
        content = <CatalogueBrowser />;
    else if (route.page === 'Listening parties')
        content = <ListeningPartyBoard />;
    else if (route.page === 'Listening party')
        content = <ListeningPartyDetail />;
    else if (route.page === 'Notifications')
        content = <Notifications />;
    else if (route.page === 'Messages')
        content = <Messages boot={boot} notify={setNotice}/>;
    else if (route.page === 'Bookmarks')
        content = <><div className="cloud-page-heading"><h1>Bookmarks</h1><form className="cloud-inline" onSubmit={async (e) => { e.preventDefault(); const form = e.currentTarget; await action('/api/cloud/collections', 'POST', { name: new FormData(form).get('name') }); form.reset(); }}><input name="name" required maxLength={40} placeholder="New collection name" aria-label="New collection name"/><button className="primary">Create collection</button></form><div className="cloud-tabs"><Link href="/bookmarks">All bookmarks</Link>{boot.collections.map(c => <span key={c.id}><Link href={'/bookmarks?collection=' + c.id}>{c.name}</Link><button aria-label={'Delete ' + c.name} onClick={() => void action('/api/cloud/collections/' + c.id, 'DELETE')}>×</button></span>)}</div>{params.get('collection') && <form className="cloud-inline" onSubmit={e => { e.preventDefault(); void action('/api/cloud/collections/' + params.get('collection'), 'PATCH', { name: new FormData(e.currentTarget).get('name') }); }}><input name="name" aria-label="Rename collection" required maxLength={40} placeholder="Rename this collection"/><button>Rename</button></form>}</div><CloudFeed key={location.search + revision} boot={boot} initialFeed="bookmarks" refresh={refresh} notify={setNotice}/></>;
    else if (['Profile', 'Fan'].includes(route.page))
        content = <CloudProfile key={profileUsername + revision} username={profileUsername} boot={boot} action={action} refresh={refresh} notify={setNotice}/>;
    else if (route.page === 'Profile studio')
        content = <CloudStudio boot={boot} save={saveProfile}/>;
    else if (['Settings', 'Account'].includes(route.page))
        content = <CloudSettings boot={boot} save={saveProfile} notify={setNotice} refresh={refresh}/>;
    else if (route.page === 'Admin')
        content = boot.profile.role === 'member' ? <div className="cloud-page-heading"><h1>Staff access required</h1><p>Your account doesn’t have access to administration.</p></div> : <AdminPanel profile={boot.profile}/>;
    else if (route.page === 'Post')
        content = <CloudPostDetail key={location.pathname + revision} boot={boot} refresh={refresh} notify={setNotice}/>;
    else
        content = <div className="cloud-page-heading"><h1>Page not found</h1><Link href="/">Return home</Link></div>;
    return <><a className="skip" href="#main">Skip to feed</a><div className="shell cloud-shell"><aside className="sidebar"><Link className="brand" href="/"><Sparkles />Your fandoms</Link><nav>{nav.map(([label, href, Icon]) => <Link key={href} href={href} className={route.page === label ? 'active' : ''}><Icon size={21}/><span>{label}</span></Link>)}{boot.profile.role !== 'member' && <Link href="/admin"><Settings size={21}/>Administration</Link>}</nav><div className="cloud-account"><Link href="/profile"><strong>{boot.profile.display_name}</strong><small>@{boot.profile.username}</small></Link><button aria-label="Sign out" onClick={async () => { try {
        await api('/api/auth/sign-out', 'POST', {});
        setBoot(null);
        navigate('/login');
    }
    catch (e) {
        setNotice((e as Error).message);
    } }}><LogOut size={18}/></button></div></aside><main id="main" className="main"><header className="cloud-topbar"><form onSubmit={e => { e.preventDefault(); navigate('/explore?q=' + encodeURIComponent(String(new FormData(e.currentTarget).get('q')))); }}><Search size={18}/><input name="q" placeholder="Search conversations and people…" aria-label="Search conversations and people" defaultValue={route.query}/></form></header>{notice && <div className="cloud-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}{content}</main><aside className="rightbar"><PartiesRail /><section className="rail-card"><h2>Your communities</h2>{boot.fandoms.filter(f => boot.memberships.includes(f.id)).slice(0, 8).map(f => <Link className="cloud-rail-link" href={'/fandoms/' + f.slug} key={f.id}>{f.name}<small>{f.members} members</small></Link>)}{!boot.memberships.length && <p>Join your first fandom to make yourself at home.</p>}<Link href="/catalogue">Find your fandom ↗</Link></section></aside></div><nav className="cloud-mobile-nav">{nav.filter(([label]) => ['Home', 'Explore', 'Notifications', 'Messages', 'Profile'].includes(label)).map(([label, href, Icon]) => <Link key={href} href={href} aria-label={label}><Icon size={21}/><small>{label}</small></Link>)}<Link href="/settings" aria-label="Settings"><Settings size={21}/><small>More</small></Link></nav></>;
}
export async function cloudImage(file: File) { if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw Error('Choose a PNG, JPEG or WebP photo.'); if (file.size > 10000000)
    throw Error('Choose an image smaller than 10 MB.'); const bitmap = await createImageBitmap(file), canvas = document.createElement('canvas'), scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height)); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale); canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close(); let value = canvas.toDataURL('image/jpeg', .8); if (value.length > 550000)
    value = canvas.toDataURL('image/jpeg', .45); if (value.length > 550000)
    throw Error('This image is too detailed. Please choose a smaller photo.'); return value; }
function CloudComposer({ boot, fandom, done, notify }: {
    boot: Boot;
    fandom?: string;
    done: () => Promise<void>;
    notify: (s: string) => void;
}) {
    const empty = { text: '', fandom: fandom || boot.memberships[0] || boot.fandoms[0]?.id || '', image: '', imageAlt: '', poll: [] as string[], spoiler: false }, [draft, setDraft] = useState(empty), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [version, setVersion] = useState(0);
    const context = fandom ? 'fandom:' + fandom : 'main';
    const draftWrite = useRef<Promise<unknown>>(Promise.resolve());
    useEffect(() => { let active = true; api<{
        draft: typeof empty | null;
    }>('/api/cloud/draft?context=' + encodeURIComponent(context)).then(v => { if (active) {
        setDraft(v.draft || empty);
        setLoaded(true);
    } }).catch(e => notify((e as Error).message)); return () => { active = false; }; }, [context]);
    useEffect(() => { if (!loaded || version === 0)
        return; let active = true; setStatus('Saving draft…'); const timer = setTimeout(() => { const saving = api('/api/cloud/draft', 'PUT', { context, draft }); draftWrite.current = saving.catch(() => { }); saving.then(() => { if (active)
        setStatus('Draft saved to your account'); }).catch(e => { if (active)
        setStatus((e as Error).message); }); }, 700); return () => { active = false; clearTimeout(timer); }; }, [draft, loaded, version]);
    const change = (v: Partial<typeof empty>) => { setDraft(d => ({ ...d, ...v })); setVersion(n => n + 1); };
    return <form className="cloud-composer" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setLoaded(false); try {
        await draftWrite.current;
        await api('/api/cloud/posts', 'POST', { ...draft, context });
        setDraft(empty);
        setVersion(0);
        setStatus('');
        await done();
    }
    catch (e) {
        notify((e as Error).message);
    }
    finally {
        setBusy(false);
        setLoaded(true);
    } }}><label className="sr-only" htmlFor="post-text">Write a post</label><textarea id="post-text" disabled={!loaded || busy} placeholder={`What’s happening, ${boot.profile.display_name}?`} maxLength={500} value={draft.text} onChange={e => change({ text: e.target.value })}/>{!fandom && <select aria-label="Post fandom" value={draft.fandom} onChange={e => change({ fandom: e.target.value })}>{boot.fandoms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>}{draft.image && <><img className="cloud-upload" src={draft.image} alt="Selected photo"/><input aria-label="Photo description" placeholder="Describe your photo" maxLength={300} value={draft.imageAlt} onChange={e => change({ imageAlt: e.target.value })}/><button type="button" onClick={() => change({ image: '', imageAlt: '' })}>Remove photo</button></>}{draft.poll.map((opt, i) => <input key={i} aria-label={'Poll option ' + (i + 1)} maxLength={100} value={opt} onChange={e => change({ poll: draft.poll.map((v, j) => j === i ? e.target.value : v) })}/>)}<div className="cloud-composer-tools"><label className="cloud-file">Photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (e) => { try {
        if (e.target.files?.[0])
            change({ image: await cloudImage(e.target.files[0]) });
    }
    catch (e) {
        notify((e as Error).message);
    } }}/></label><button type="button" onClick={() => change({ poll: draft.poll.length ? [] : ['', ''] })}>{draft.poll.length ? 'Remove poll' : 'Poll'}</button>{draft.poll.length > 0 && draft.poll.length < 4 && <button type="button" onClick={() => change({ poll: [...draft.poll, ''] })}>Add option</button>}<label><input type="checkbox" checked={draft.spoiler} onChange={e => change({ spoiler: e.target.checked })}/>Spoiler</label><button className="primary" disabled={!loaded || busy || !draft.fandom || (!draft.text.trim() && !draft.image)}>{busy ? 'Posting…' : 'Post'}</button></div><small role="status">{status}</small></form>;
}
export function CloudFeed({ boot, fandom, author, initialFeed, refresh, notify, discover = false }: {
    boot: Boot;
    fandom?: string;
    author?: string;
    initialFeed?: string;
    refresh: () => Promise<void>;
    notify: (s: string) => void;
    discover?: boolean;
}) {
    const params = new URLSearchParams(location.search), feed = initialFeed || params.get('feed') || (discover ? 'latest' : 'fandoms'), [items, setItems] = useState<CloudPost[]>([]), [next, setNext] = useState<number | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [rev, setRev] = useState(0);
    function path(cursor?: number | null) { const p = new URLSearchParams({ feed }); if (fandom)
        p.set('fandom', fandom); if (author)
        p.set('author', author); for (const k of ['q', 'collection'])
        if (params.get(k))
            p.set(k, params.get(k)!); if (cursor)
        p.set('before', String(cursor)); return '/api/cloud/feed?' + p; }
    async function get(more = false) { setBusy(true); try {
        const v = await api<Page<CloudPost>>(path(more ? next : null));
        setItems(old => more ? [...old, ...v.items] : v.items);
        setNext(v.next as number | null);
        setError('');
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    useEffect(() => { void get(); }, [feed, fandom, author, location.search, rev]);
    const done = async () => { setRev(n => n + 1); };
    const visibleItems = items.filter(p => !boot.preferences.mutedWords.some(w => p.text.toLowerCase().includes(w.toLowerCase())) && (!(!author && !fandom && feed !== "bookmarks") || !boot.hiddenFandoms.includes(p.fandom_id)));
    return <>{!author && feed !== 'bookmarks' && <><div className="cloud-page-heading"><h1>{fandom ? 'Conversations' : discover ? 'Explore' : 'Home'}</h1></div>{!fandom && <div className="cloud-tabs">{[['fandoms', 'My fandoms'], ['following', 'Following'], ['latest', 'Discover']].map(([value, label]) => <Link key={value} className={feed === value ? 'active' : ''} href={location.pathname + '?feed=' + value}>{label}</Link>)}</div>}<CloudComposer boot={boot} fandom={fandom} done={done} notify={notify}/></>}{discover && <PeopleSearch boot={boot} notify={notify}/>}<form className="cloud-feed-search" onSubmit={e => { e.preventDefault(); const p = new URLSearchParams(location.search); const q = String(new FormData(e.currentTarget).get('q')); if (q)
        p.set('q', q);
    else
        p.delete('q'); navigate(location.pathname + '?' + p); }}><input name="q" aria-label="Search this feed" placeholder="Search conversations" defaultValue={params.get('q') || ''}/><button>Search</button></form>{error && <p className="save-error" role="alert">{error}<button onClick={() => void get()}>Retry</button></p>}{visibleItems.map(p => <CloudPostCard key={p.id} post={p} boot={boot} done={done} notify={notify}/>)}{!busy && !error && !visibleItems.length && <div className="cloud-empty"><Sparkles /><h2>No conversations yet</h2><p>{feed === 'fandoms' && !boot.memberships.length ? 'Join a fandom to start building your feed.' : 'Be the first to start a conversation, or explore more fandoms.'}</p><Link href="/catalogue">Find your fandom</Link></div>}{busy && <p className="cloud-empty" role="status">Loading conversations…</p>}{next && <button className="secondary cloud-more" disabled={busy} onClick={() => void get(true)}>Load more</button>}</>;
}
function CloudPostCard({ post: p, boot, done, notify }: {
    post: CloudPost;
    boot: Boot;
    done: () => Promise<void>;
    notify: (s: string) => void;
}) {
    const [busy, setBusy] = useState(false), [reveal, setReveal] = useState(false), [editing, setEditing] = useState(false), [edit, setEdit] = useState(p.text);
    async function act(path: string, method: string, data?: unknown) { setBusy(true); try {
        await api(path, method, data);
        await done();
    }
    catch (e) {
        notify((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    const total = p.pollCounts?.reduce((n, v) => n + v.count, 0) || 0;
    return <article className="cloud-post"><header><Link href={'/fans/' + p.username} className="cloud-avatar">{p.avatar ? <img src={p.avatar} alt=""/> : p.display_name.slice(0, 1)}</Link><div><Link href={'/fans/' + p.username}><strong>{p.display_name}</strong> <span>@{p.username}</span></Link><Link className="cloud-post-meta" href={'/posts/' + p.id}>{new Date(p.created_at).toLocaleString('en-GB')}</Link></div><Link className="cloud-fandom-tag" href={'/community?fandom=' + p.fandom_id}>{p.fandom_name}</Link></header>{editing ? <form onSubmit={e => { e.preventDefault(); void act('/api/posts/' + p.id, 'PATCH', { text: edit }).then(() => setEditing(false)); }}><textarea maxLength={500} value={edit} onChange={e => setEdit(e.target.value)}/><button disabled={busy}>Save edit</button><button type="button" onClick={() => setEditing(false)}>Cancel</button></form> : p.spoiler && boot.preferences.hideSpoilers && !reveal ? <button className="cloud-spoiler" onClick={() => setReveal(true)}>Spoiler · Tap to reveal</button> : <><p className="cloud-post-text">{p.text}</p>{p.image && <a href={p.image} target="_blank" rel="noreferrer"><img className="cloud-post-image" src={p.image} alt={p.image_alt || 'Photo attached to post'}/></a>}{p.poll?.length > 0 && <div className="cloud-poll">{p.poll.map((option, i) => { const count = p.pollCounts?.find(v => v.choice === i)?.count || 0; return <button disabled={busy} key={i} aria-pressed={p.vote === i} onClick={() => void act('/api/cloud/posts/' + p.id + '/vote', 'PUT', { choice: i })}>{option}<span>{p.vote !== null ? Math.round(total ? count / total * 100 : 0) + '%' : ''}{p.vote === i ? ' ✓' : ''}</span></button>; })}<small>{total} votes</small></div>}</>}<div className="cloud-post-actions"><Link href={'/posts/' + p.id}><MessageCircle size={17}/>{p.replies || 0}</Link><button disabled={busy} aria-label="Repost" aria-pressed={Boolean(p.reposted)} onClick={() => void act('/api/cloud/posts/' + p.id + '/repost', p.reposted ? 'DELETE' : 'PUT')}><Repeat2 size={17}/>{p.reposts || 0}</button><button disabled={busy} aria-label="Like" aria-pressed={Boolean(p.liked)} onClick={() => void act('/api/posts/' + p.id + '/likes', p.liked ? 'DELETE' : 'PUT')}><Heart size={17}/>{p.likes || 0}</button><button disabled={busy} aria-label="Bookmark" aria-pressed={Boolean(p.bookmarked)} onClick={() => void act('/api/posts/' + p.id + '/bookmarks', p.bookmarked ? 'DELETE' : 'PUT')}><Bookmark size={17}/></button></div><details className="cloud-post-menu"><summary>More options</summary><select aria-label="Save to collection" defaultValue="" disabled={busy} onChange={e => void act('/api/cloud/posts/' + p.id + '/collection', 'PUT', { collection: e.target.value })}><option value="">All bookmarks</option>{boot.collections.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select>{p.user_id === boot.profile.user_id ? <><button onClick={() => setEditing(true)}>Edit post</button><button disabled={busy} onClick={() => void act('/api/posts/' + p.id, 'DELETE')}>Delete post</button></> : <><Link href={'/fans/' + p.username}>View profile and account controls</Link><form onSubmit={e => { e.preventDefault(); void act('/api/posts/' + p.id + '/reports', 'POST', { reason: new FormData(e.currentTarget).get('reason') }); }}><input name="reason" aria-label="Report reason" required maxLength={500} placeholder="Why are you reporting this post?"/><button disabled={busy}>Report to moderators</button></form></>}</details></article>;
}
function CloudProfile({ username, boot, action, refresh, notify }: {
    username: string;
    boot: Boot;
    action: (p: string, m?: string, d?: unknown) => Promise<void>;
    refresh: () => Promise<void>;
    notify: (s: string) => void;
}) {
    const [profile, setProfile] = useState<(LiveProfile & {
        avatar: string;
        theme: ProfileStyle;
        followers: number;
        following_count: number;
        following: number;
        muted: number;
        blocked: number;
    }) | null>(null), [error, setError] = useState('');
    useEffect(() => { let active = true; api<{
        profile: NonNullable<typeof profile>;
    }>('/api/cloud/fans/' + username).then(v => { if (active)
        setProfile(v.profile); }).catch(e => { if (active)
        setError((e as Error).message); }); return () => { active = false; }; }, [username]);
    if (error)
        return <p className="save-error" role="alert">{error}</p>;
    if (!profile)
        return <p className="cloud-empty">Loading profile…</p>;
    const own = profile.user_id === boot.profile.user_id, theme = { ...defaultProfileStyle, ...profile.theme }, style = parseThemeCss(theme.css).values as CSSProperties;
    return <><section className="custom-profile compact-profile" style={style}><div className={'profile-cover pattern-' + theme.pattern}>{theme.coverImage && <img src={theme.coverImage} alt="Profile cover"/>}</div><div className="profile-body"><div className="cloud-avatar">{profile.avatar ? <img src={profile.avatar} alt=""/> : profile.display_name.slice(0, 1)}</div><h1>{profile.display_name}</h1><p>@{profile.username}</p>{theme.tagline && <p>{theme.tagline}</p>}<p>{profile.bio}</p>{theme.showStats && <p>{profile.followers} followers · {profile.following_count} following</p>}{theme.pinnedPostId && <Link className="profile-pin" href={"/posts/" + theme.pinnedPostId}>Pinned conversation ↗</Link>}<div className="cloud-profile-buttons">{own ? <><Link className="secondary" href="/settings">Edit profile</Link><Link className="primary" href="/profile/edit">Customise profile</Link></> : <><button className="primary" onClick={() => void action('/api/follows/' + profile.user_id, profile.following ? 'DELETE' : 'PUT')}>{profile.following ? 'Following · Unfollow' : 'Follow'}</button><Link className="secondary" href={'/messages?with=' + profile.user_id}>Message</Link><button onClick={() => void action('/api/cloud/mutes/' + profile.user_id, profile.muted ? 'DELETE' : 'PUT')}>{profile.muted ? 'Unmute' : 'Mute'}</button><button onClick={() => void action('/api/blocks/' + profile.user_id, profile.blocked ? 'DELETE' : 'PUT')}>{profile.blocked ? 'Unblock' : 'Block'}</button></>}</div></div></section><div className="cloud-tabs">{[['latest', 'Posts'], ['media', 'Media'], ['reposts', 'Reposts']].map(([feed, label]) => <Link href={location.pathname + '?feed=' + feed} key={feed}>{label}</Link>)}</div>{(theme.song || theme.album || theme.quote) && <details className="cloud-profile-about"><summary>About {profile.display_name}</summary>{theme.song && <p>On repeat: {theme.song}</p>}{theme.album && <p>Favourite album: {theme.album}</p>}{theme.quote && <blockquote>{theme.quote}</blockquote>}</details>}{profile.blocked ? <p className="cloud-empty">You have blocked this account.</p> : <CloudFeed boot={boot} author={profile.username} refresh={refresh} notify={notify} initialFeed={new URLSearchParams(location.search).get('feed') || 'latest'}/>}</>;
}
function CloudSettings({ boot, save, notify, refresh }: {
    boot: Boot;
    save: (b: Boot) => Promise<void>;
    notify: (s: string) => void;
    refresh: () => Promise<void>;
}) {
    const [username, setUsername] = useState(boot.profile.username), [name, setName] = useState(boot.profile.display_name), [bio, setBio] = useState(boot.profile.bio), [avatar, setAvatar] = useState(boot.profile.avatar), [preferences, setPreferences] = useState(boot.preferences), [busy, setBusy] = useState(false), [blocks, setBlocks] = useState<{
        user_id: string;
        username: string;
    }[]>([]);
    useEffect(() => { api<{
        items: typeof blocks;
    }>('/api/me/blocks').then(v => setBlocks(v.items)).catch(e => notify((e as Error).message)); }, []);
    return <section className="cloud-page-heading"><h1>Your account</h1><p>@{boot.profile.username}</p><div className="cloud-tabs"><Link href="/profile">View profile</Link><Link href="/profile/edit">Profile studio</Link><Link href="/fandoms">Fandoms</Link><Link href="/bookmarks">Bookmarks</Link><Link href="/parties">Listening parties</Link>{boot.profile.role !== 'member' && <Link href="/admin">Administration</Link>}</div><form className="cloud-form" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try {
        await save({ ...boot, profile: { ...boot.profile, display_name: name, username, bio, avatar }, preferences });
    }
    catch { /* Save reports the server error. */ }
    finally {
        setBusy(false);
    } }}><h2>Your profile</h2><label>Username<input aria-label="Username" value={username} onChange={e => setUsername(e.target.value.toLowerCase())} required pattern="[a-z0-9_]{3,24}" maxLength={24}/></label><label>Display name<input aria-label="Display name" value={name} onChange={e => setName(e.target.value)} required maxLength={40}/></label><label>Bio<textarea aria-label="Bio" value={bio} onChange={e => setBio(e.target.value)} maxLength={180}/></label><label>Profile photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (e) => { try {
        if (e.target.files?.[0])
            setAvatar(await cloudImage(e.target.files[0]));
    }
    catch (e) {
        notify((e as Error).message);
    } }}/></label>{avatar && <><img className="cloud-settings-avatar" src={avatar} alt="Your profile photo"/><button type="button" onClick={() => setAvatar('')}>Remove photo</button></>}<h2>Reading preferences</h2>{(['compact', 'largeText', 'hideSpoilers'] as const).map(k => <label className="cloud-checkbox" key={k}><input type="checkbox" checked={preferences[k]} onChange={e => setPreferences(p => ({ ...p, [k]: e.target.checked }))}/>{{ compact: 'Compact layout', largeText: 'Larger text', hideSpoilers: 'Hide spoilers until I reveal them' }[k]}</label>)}<label>Muted words, one per line<textarea value={preferences.mutedWords.join('\n')} onChange={e => setPreferences(p => ({ ...p, mutedWords: e.target.value.split('\n').filter(Boolean) }))}/></label><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save account settings'}</button></form><section className="cloud-account-controls"><h2>Your home feed</h2><p>Hide a fandom from Home without leaving it.</p>{boot.fandoms.filter(f => boot.memberships.includes(f.id)).map(f => <label className="cloud-checkbox" key={f.id}><input type="checkbox" checked={boot.hiddenFandoms.includes(f.id)} onChange={async (e) => { try {
        await api('/api/cloud/hidden-fandoms/' + f.id, e.target.checked ? 'PUT' : 'DELETE');
        await refresh();
    }
    catch (e) {
        notify((e as Error).message);
    } }}/>Hide {f.name}</label>)}</section><section className="cloud-account-controls"><h2>Muted accounts</h2>{boot.mutes.map(p => <div key={p.user_id}>@{p.username}<button onClick={async () => { try {
        await api('/api/cloud/mutes/' + p.user_id, 'DELETE');
        await refresh();
    }
    catch (e) {
        notify((e as Error).message);
    } }}>Unmute</button></div>)}{!boot.mutes.length && <p>You haven’t muted anyone.</p>}</section><section className="cloud-account-controls"><h2>Blocked accounts</h2>{blocks.map(p => <div key={p.user_id}>@{p.username}<button onClick={async () => { try {
        await api('/api/blocks/' + p.user_id, 'DELETE');
        setBlocks(v => v.filter(b => b.user_id !== p.user_id));
    }
    catch (e) {
        notify((e as Error).message);
    } }}>Unblock</button></div>)}{!blocks.length && <p>You haven’t blocked anyone.</p>}</section><p>Your date of birth is private. Your profile, preferences and activity are saved to your account.</p></section>;
}
function PeopleSearch({ boot, notify }: {
    boot: Boot;
    notify: (s: string) => void;
}) {
    const [items, setItems] = useState<(LiveProfile & {
        following: number;
    })[]>([]), q = new URLSearchParams(location.search).get('q') || '';
    useEffect(() => { let active = true; if (!q) {
        setItems([]);
        return;
    } api<Page<LiveProfile & {
        following: number;
    }>>('/api/people?q=' + encodeURIComponent(q)).then(v => { if (active)
        setItems(v.items.filter(p => p.user_id !== boot.profile.user_id)); }).catch(e => notify((e as Error).message)); return () => { active = false; }; }, [q]);
    return items.length ? <section className="cloud-people"><h2>People</h2>{items.map(p => <Link key={p.user_id} href={'/fans/' + p.username}><strong>{p.display_name}</strong><span>@{p.username}</span></Link>)}</section> : null;
}
function Notifications() {
    const [items, setItems] = useState<Record<string, string | number | null>[]>([]), [next, setNext] = useState<number | null>(null), [error, setError] = useState(''), [loaded, setLoaded] = useState(false);
    async function get(more = false) { try {
        const v = await api<Page<Record<string, string | number | null>>>('/api/cloud/notifications' + (more && next ? '?before=' + next : ''));
        setItems(old => more ? [...old, ...v.items] : v.items);
        setNext(v.next as number | null);
        setLoaded(true);
    }
    catch (e) {
        setError((e as Error).message);
    } }
    useEffect(() => { void get(); const timer = setInterval(() => void get(), 30000); return () => clearInterval(timer); }, []);
    return <section className="cloud-page-heading"><h1>Notifications</h1><button className="secondary" onClick={async () => { try {
        await api('/api/cloud/notifications/read', 'PUT', {});
        await get();
    }
    catch (e) {
        setError((e as Error).message);
    } }}>Mark all as read</button>{error && <p role="alert">{error}</p>}{items.map(n => <article className={'cloud-notification ' + (n.read_at ? '' : 'unread')} key={n.id}><Link href={n.post_id ? '/posts/' + n.post_id : '/fans/' + n.username}><strong>{n.display_name}</strong> {{ like: 'liked your post', reply: 'replied to your post', follow: 'followed you' }[String(n.kind)] || 'interacted with you'}<small>{new Date(String(n.created_at)).toLocaleString('en-GB')}</small></Link></article>)}{loaded && !items.length && <div className="cloud-empty"><Bell /><h2>You’re all caught up</h2><p>Real replies, likes and new followers will appear here.</p></div>}{next && <button onClick={() => void get(true)}>Load more</button>}</section>;
}
function Messages({ boot, notify }: {
    boot: Boot;
    notify: (s: string) => void;
}) {
    const target = new URLSearchParams(location.search).get('with') || '', [items, setItems] = useState<Record<string, string | number | null>[]>([]), [people, setPeople] = useState<LiveProfile[]>([]), [next, setNext] = useState<number | null>(null), [text, setText] = useState(''), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false), [error, setError] = useState('');
    async function get(more = false) { try {
        const p = new URLSearchParams();
        if (target)
            p.set('with', target);
        if (more && next)
            p.set('before', String(next));
        const v = await api<Page<Record<string, string | number | null>>>('/api/cloud/messages?' + p);
        setItems(old => more ? [...old, ...v.items] : v.items);
        setNext(v.next as number | null);
        setLoaded(true);
        if (target)
            await api('/api/cloud/messages/read', 'PUT', { sender: target });
    }
    catch (e) {
        setError((e as Error).message);
    } }
    useEffect(() => { setLoaded(false); setItems([]); setError(''); void get(); const timer = setInterval(() => { if (!document.hidden)
        void get(); }, 15000); return () => clearInterval(timer); }, [target]);
    const conversations = Array.from(new Map(items.map(m => { const incoming = m.sender_id !== boot.profile.user_id; return [String(incoming ? m.sender_id : m.recipient_id), m] as const; })).entries());
    return <section className="cloud-page-heading"><h1>Messages</h1><Link href="/messages">Inbox</Link><form className="cloud-inline" onSubmit={async (e) => { e.preventDefault(); try {
        const q = String(new FormData(e.currentTarget).get('q'));
        const v = await api<Page<LiveProfile>>('/api/people?q=' + encodeURIComponent(q));
        setPeople(v.items.filter(p => p.user_id !== boot.profile.user_id));
    }
    catch (e) {
        notify((e as Error).message);
    } }}><input name="q" placeholder="Find someone by username" aria-label="Find a recipient" minLength={1} required/><button>Find</button></form>{people.map(p => <Link className="cloud-rail-link" href={'/messages?with=' + p.user_id} key={p.user_id}>{p.display_name} · @{p.username}</Link>)}{error && <p role="alert">{error}</p>}{target ? <><div className="cloud-messages">{items.slice().reverse().map(m => <article className={m.sender_id === boot.profile.user_id ? 'outgoing' : 'incoming'} key={m.id}><strong>{String(m.sender_name)}</strong><p>{m.text}</p><small>{new Date(String(m.created_at)).toLocaleString('en-GB')}{m.sender_id === boot.profile.user_id && m.read_at ? ' · Read' : ''}</small></article>)}</div><form className="cloud-form" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try {
        await api('/api/cloud/messages', 'POST', { recipient: target, text });
        setText('');
        await get();
    }
    catch (e) {
        notify((e as Error).message);
    }
    finally {
        setBusy(false);
    } }}><label>Message<textarea aria-label="Message" maxLength={2000} required value={text} onChange={e => setText(e.target.value)}/></label><button className="primary" disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send message'}</button></form></> : conversations.map(([id, m]) => <Link className="cloud-conversation" href={'/messages?with=' + id} key={id}><strong>{String(m.sender_id === boot.profile.user_id ? m.recipient_name : m.sender_name)}</strong><p>{m.text}</p></Link>)}{loaded && !items.length && <p className="cloud-empty">{target ? 'Start your conversation.' : 'No messages yet. Find someone above to start a conversation.'}</p>}{next && <button onClick={() => void get(true)}>Load older messages</button>}</section>;
}
function CloudPostDetail({ boot, refresh, notify }: {
    boot: Boot;
    refresh: () => Promise<void>;
    notify: (s: string) => void;
}) {
    const id = location.pathname.split('/').pop(), [post, setPost] = useState<CloudPost | null>(null), [replies, setReplies] = useState<Record<string, string | number>[]>([]), [next, setNext] = useState<number | null>(null), [text, setText] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    async function get(more = false) { try {
        if (!more) {
            const v = await api<{
                post: CloudPost;
            }>('/api/cloud/posts/' + id);
            setPost(v.post);
        }
        const r = await api<Page<Record<string, string | number>>>('/api/posts/' + id + '/replies' + (more && next ? '?before=' + next : ''));
        setReplies(old => more ? [...old, ...r.items] : r.items);
        setNext(r.next as number | null);
    }
    catch (e) {
        setError((e as Error).message);
    } }
    useEffect(() => { void get(); }, [id]);
    return <><div className="cloud-page-heading"><Link href="/">← Home</Link><h1>Conversation</h1></div>{error && <p role="alert" className="save-error">{error}</p>}{post && <CloudPostCard post={post} boot={boot} notify={notify} done={async () => { await get(); await refresh(); }}/>}<form className="cloud-form cloud-reply-form" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try {
        await api('/api/posts/' + id + '/replies', 'POST', { text });
        setText('');
        await get();
    }
    catch (e) {
        notify((e as Error).message);
    }
    finally {
        setBusy(false);
    } }}><label>Your reply<textarea aria-label="Your reply" value={text} maxLength={500} required onChange={e => setText(e.target.value)}/></label><button className="primary" disabled={busy}>Reply</button></form>{replies.map(r => <article className="cloud-reply" key={r.id}><Link href={'/fans/' + r.username}><strong>{r.display_name}</strong> @{r.username}</Link><p>{r.text}</p><small>{new Date(String(r.created_at)).toLocaleString('en-GB')}</small>{r.user_id === boot.profile.user_id && <button onClick={async () => { try {
        await api('/api/replies/' + r.id, 'DELETE');
        await get();
    }
    catch (e) {
        notify((e as Error).message);
    } }}>Delete reply</button>}</article>)}{next && <button onClick={() => void get(true)}>Load more replies</button>}</>;
}
export function CloudEvents({ boot, fandom, notify }: {
    boot: Boot;
    fandom?: string;
    notify: (s: string) => void;
}) {
    const [items, setItems] = useState<Record<string, string | number>[]>([]), [next, setNext] = useState<number | null>(null), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
    async function get(more = false) { try {
        const p = new URLSearchParams();
        if (fandom)
            p.set('fandom', fandom);
        if (more && next)
            p.set('before', String(next));
        const v = await api<Page<Record<string, string | number>>>('/api/cloud/events?' + p);
        setItems(old => more ? [...old, ...v.items] : v.items);
        setNext(v.next as number | null);
    }
    catch (e) {
        setError((e as Error).message);
    } }
    useEffect(() => { void get(); }, [fandom]);
    async function act(path: string, method: string) { try {
        await api(path, method);
        await get();
    }
    catch (e) {
        notify((e as Error).message);
    } }
    return <><ListeningPartyBoard embedded fandom={fandom ? { id: fandom, name: boot.fandoms.find(f => f.id === fandom)?.name || '' } : undefined}/><section className="cloud-page-heading"><h2>Community events</h2><button className="primary" onClick={() => setOpen(v => !v)}>Plan an event</button>{open && <form className="cloud-form" onSubmit={async (e) => { e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true); try {
        await api('/api/cloud/events', 'POST', { fandom: fandom || form.get('fandom'), title: form.get('title'), description: form.get('description'), startsAt: new Date(String(form.get('start'))).toISOString() });
        setOpen(false);
        await get();
    }
    catch (e) {
        notify((e as Error).message);
    }
    finally {
        setBusy(false);
    } }}>{!fandom && <label>Fandom<select name="fandom">{boot.fandoms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}<label>Event title<input name="title" maxLength={100} required/></label><label>About<textarea name="description" maxLength={1000}/></label><label>Date and time<input name="start" type="datetime-local" required/></label><button className="primary" disabled={busy}>Publish event</button></form>}{error && <p role="alert">{error}</p>}{items.map(e => <article className="cloud-event" key={e.id}><h3>{e.title}</h3><Link href={'/fans/' + e.username}>Hosted by {e.display_name}</Link><p>{e.description}</p><p>{new Date(String(e.starts_at)).toLocaleString('en-GB')} · {e.going} going · {e.status}</p>{e.status === 'scheduled' && <><button className="secondary" onClick={() => void act('/api/cloud/events/' + e.id + '/rsvp', e.rsvp ? 'DELETE' : 'PUT')}>{e.rsvp ? 'Going · Remove RSVP' : 'I’m going'}</button>{e.user_id === boot.profile.user_id && <button onClick={() => void act('/api/cloud/events/' + e.id, 'DELETE')}>Cancel event</button>}</>}</article>)}{!items.length && !error && <p className="cloud-empty">No community events yet. Start the first plan.</p>}{next && <button onClick={() => void get(true)}>Load more events</button>}</section></>;
}
function CloudStudio({ boot, save }: {
    boot: Boot;
    save: (b: Boot) => Promise<void>;
}) { const [posts, setPosts] = useState<CloudPost[]>([]), [error, setError] = useState(''), [loaded, setLoaded] = useState(false); useEffect(() => { api<Page<CloudPost>>('/api/cloud/feed?feed=latest&author=' + encodeURIComponent(boot.profile.username) + '&limit=50').then(v => { setPosts(v.items); setLoaded(true); }).catch(e => setError((e as Error).message)); }, []); if (error)
    return <p className="save-error" role="alert">{error}</p>; if (!loaded)
    return <p className="cloud-empty">Opening your profile studio…</p>; const state: State = { ...freshState(), profile: { name: boot.profile.display_name, bio: boot.profile.bio, avatar: boot.profile.avatar, username: boot.profile.username }, profileStyle: boot.theme, preferences: boot.preferences, joined: boot.memberships, posts: posts.map(p => ({ id: p.id, author: p.display_name, handle: p.username, avatar: p.avatar, fandom: p.fandom_id, text: p.text, likes: p.likes, following: false, own: true, image: p.image, createdAt: p.created_at })) }; return <ProfileStudio state={state} update={fn => save({ ...boot, theme: fn(state).profileStyle })} onNotice={() => { }}/>; }
