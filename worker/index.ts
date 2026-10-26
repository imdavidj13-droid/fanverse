import { createAuth } from "./auth";
import { admin } from "./admin";
import { parties } from "./parties";
import { body, HttpError, json, limit, pageCursor, text } from "./http";
import { checkOrigin, identity, throttle, visiblePost } from "./security";
import { configured, emailConfigured, type Env } from "./types";
import {
  cataloguePublic,
  catalogueMember,
  catalogueAdmin,
  resolveFandom,
} from "./catalogue";
const catalogueLimits = new Map<string, { minute: number; count: number }>();
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url),
      path = url.pathname;
    if (!path.startsWith("/api/"))
      return env.ASSETS
        ? env.ASSETS.fetch(request)
        : new Response("Not found", { status: 404 });
    try {
      if (path.startsWith("/api/catalogue/")) {
        const key = request.headers.get("cf-connecting-ip") || "local",
          minute = Math.floor(Date.now() / 60000),
          old = catalogueLimits.get(key),
          value =
            old?.minute === minute
              ? { minute, count: old.count + 1 }
              : { minute, count: 1 };
        if (catalogueLimits.size > 1000)
          catalogueLimits.delete(catalogueLimits.keys().next().value!);
        catalogueLimits.set(key, value);
        if (value.count > 15)
          throw new HttpError(
            429,
            "Please wait a minute before searching again.",
          );
        return await cataloguePublic(request, env);
      }
      if (path === "/api/status" || path === "/api/auth-methods") {
        let ready =
          configured(env) &&
          new URL(env.BETTER_AUTH_URL!).origin === url.origin;
        if (ready) {
          try {
            ready = Boolean(
              await env
                .DB!.prepare("SELECT version FROM app_meta WHERE version>=2")
                .first(),
            );
          } catch {
            ready = false;
          }
        }
        if (path === "/api/auth-methods") return json({
          email: Boolean(ready && emailConfigured(env)), phone: false,
          google: Boolean(ready && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
          apple: Boolean(ready && env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET),
        });
        return json({ ready, mode: ready ? "shared" : "preview" });
      }
      if (
        !configured(env) ||
        new URL(env.BETTER_AUTH_URL!).origin !== url.origin
      )
        throw new HttpError(
          503,
          "Shared accounts are not connected yet. The local preview is still available.",
        );
      let schemaReady = false;
      try {
        schemaReady = Boolean(
          await env
            .DB!.prepare("SELECT version FROM app_meta WHERE version>=2")
            .first(),
        );
      } catch {
        /* Account writes stay disabled until the migration is complete. */
      }
      if (!schemaReady)
        throw new HttpError(
          503,
          "The community database setup is not complete yet.",
        );
      const appleReturn = path === "/api/auth/callback/apple" && request.method === "POST" && Boolean(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET) && request.headers.get("origin") === "https://appleid.apple.com";
      if (!appleReturn) checkOrigin(request, env);
      if (appleReturn) {
        if (!request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) throw new HttpError(415,"Invalid Apple callback format.");
        const reader = request.clone().body?.getReader();
        let size = 0;
        if (reader) while (true) { const chunk = await reader.read(); if(chunk.done)break; size+=chunk.value.byteLength; if(size>12000){void reader.cancel();throw new HttpError(413,"Request is too large.");} }
      }
      if (path.startsWith("/api/auth/")) {
        if (!emailConfigured(env) && ["/api/auth/sign-up/email", "/api/auth/sign-in/email", "/api/auth/request-password-reset", "/api/auth/reset-password", "/api/auth/send-verification-email"].includes(path))
          throw new HttpError(503,"Email sign-in is not connected yet. Use an available Google or Apple sign-in option.");
        if (!appleReturn && !["GET", "HEAD"].includes(request.method))
          await body(request.clone());
        return await createAuth(env).handler(request);
      }
      const db = env.DB!,
        person = await identity(request, env, false),
        viewer = person?.user_id || null;
      if (path === "/api/parties" || path.startsWith("/api/parties/")) return await parties(request, env, person);
      if (path === "/api/me" && request.method === "GET") {
        if (!person) return json({ profile: null });
        const memberships = await db
          .prepare("SELECT fandom_id FROM fandom_memberships WHERE user_id=?")
          .bind(viewer)
          .all();
        return json({
          profile: person,
          onboardingCompleted: Boolean(await db.prepare("SELECT user_id FROM account_onboarding WHERE user_id=?").bind(viewer).first().catch(() => null)),
          memberships: memberships.results.map((row) => row.fandom_id),
        });
      }
      if (
        ["/api/me/blocks", "/api/me/follows"].includes(path) &&
        request.method === "GET"
      ) {
        if (!person) throw new HttpError(401, "Please sign in.");
        const isBlock = path.endsWith("/blocks"),
          table = isBlock ? "blocks" : "follows",
          column = isBlock ? "blocked_id" : "following_id";
        const rows = await db
          .prepare(
            `SELECT a.user_id,a.username,a.display_name FROM ${table} b JOIN profiles a ON a.user_id=b.${column} WHERE b.user_id=? ORDER BY a.username LIMIT 100`,
          )
          .bind(viewer)
          .all();
        return json({ items: rows.results });
      }
      if (path === "/api/posts" && request.method === "GET") {
        const n = limit(url),
          before = pageCursor(url),
          fandomInput = url.searchParams.get("fandom"),
          feed = url.searchParams.get("feed") || "latest";
        const fandom = fandomInput
          ? (await resolveFandom(db, fandomInput)).id
          : null;
        if (!["latest", "following", "fandoms", "bookmarks"].includes(feed))
          throw new HttpError(400, "Unknown feed.");
        if (feed !== "latest" && !person)
          throw new HttpError(401, "Please sign in.");
        const rows = await db
          .prepare(
            `SELECT p.id,p.user_id,p.fandom_id,p.text,p.created_at,p.updated_at,a.username,a.display_name,
    (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) likes,
    EXISTS(SELECT 1 FROM follows f WHERE f.user_id=? AND f.following_id=p.user_id) following,
    EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.user_id=?) liked,
    EXISTS(SELECT 1 FROM post_bookmarks b WHERE b.post_id=p.id AND b.user_id=?) bookmarked
    FROM posts p JOIN profiles a ON a.user_id=p.user_id JOIN fandoms directory ON directory.id=p.fandom_id AND directory.status='active' WHERE p.status='published' AND a.status='active' AND p.id<? AND (? IS NULL OR p.fandom_id=?)
    AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=p.user_id) OR (b.user_id=p.user_id AND b.blocked_id=?))
    AND (?!='following' OR p.user_id=? OR EXISTS(SELECT 1 FROM follows f WHERE f.user_id=? AND f.following_id=p.user_id))
    AND (?!='fandoms' OR EXISTS(SELECT 1 FROM fandom_memberships m WHERE m.user_id=? AND m.fandom_id=p.fandom_id))
    AND (?!='bookmarks' OR EXISTS(SELECT 1 FROM post_bookmarks b WHERE b.user_id=? AND b.post_id=p.id))
    ORDER BY p.id DESC LIMIT ?`,
          )
          .bind(
            viewer,
            viewer,
            viewer,
            before,
            fandom,
            fandom,
            viewer,
            viewer,
            feed,
            viewer,
            viewer,
            feed,
            viewer,
            feed,
            viewer,
            n + 1,
          )
          .all();
        return json({
          items: rows.results.slice(0, n),
          next: rows.results.length > n ? rows.results[n - 1].id : null,
        });
      }
      if (path === "/api/fandoms" && request.method === "GET") {
        const n = limit(url),
          after = url.searchParams.get("after") || "";
        const rows = await db
          .prepare(
            "SELECT id,slug,name,description,kind,wikidata_id FROM fandoms WHERE status='active' AND id>? ORDER BY id LIMIT ?",
          )
          .bind(after, n + 1)
          .all();
        return json({
          items: rows.results.slice(0, n),
          next: rows.results.length > n ? rows.results[n - 1].id : null,
        });
      }
      if (/^\/api\/fandoms\/[^/]+$/.test(path) && request.method === "GET")
        return json({
          fandom: await resolveFandom(
            db,
            decodeURIComponent(path.split("/").pop()!),
          ),
        });
      if (path === "/api/people" && request.method === "GET") {
        const n = limit(url),
          q = (url.searchParams.get("q") || "")
            .slice(0, 40)
            .replace(/[\\%_]/g, "\\$&"),
          after = url.searchParams.get("after") || "";
        const rows = await db
          .prepare(
            `SELECT a.user_id,a.username,a.display_name,a.bio,EXISTS(SELECT 1 FROM follows f WHERE f.user_id=? AND f.following_id=a.user_id) following FROM profiles a WHERE a.status='active' AND a.user_id>? AND a.username LIKE ? ESCAPE '\\' AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=a.user_id) OR (b.user_id=a.user_id AND b.blocked_id=?)) ORDER BY a.user_id LIMIT ?`,
          )
          .bind(viewer, after, "%" + q + "%", viewer, viewer, n + 1)
          .all();
        return json({
          items: rows.results.slice(0, n),
          next: rows.results.length > n ? rows.results[n - 1].user_id : null,
        });
      }
      const replyPath = path.match(/^\/api\/posts\/(\d+)\/replies$/);
      if (replyPath && request.method === "GET") {
        const postId = Number(replyPath[1]);
        await visiblePost(env, postId, viewer);
        const n = limit(url),
          before = pageCursor(url);
        const rows = await db
          .prepare(
            `SELECT r.id,r.text,r.created_at,r.user_id,a.username,a.display_name FROM replies r JOIN profiles a ON a.user_id=r.user_id WHERE r.post_id=? AND r.status='published' AND a.status='active' AND r.id<? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=r.user_id) OR (b.user_id=r.user_id AND b.blocked_id=?)) ORDER BY r.id DESC LIMIT ?`,
          )
          .bind(postId, before, viewer, viewer, n + 1)
          .all();
        return json({
          items: rows.results.slice(0, n),
          next: rows.results.length > n ? rows.results[n - 1].id : null,
        });
      }
      if (!person) throw new HttpError(401, "Please sign in.");
      if (!["GET", "HEAD"].includes(request.method))
        await throttle(env, person);
      if (
        path.startsWith("/api/admin/fandoms") ||
        path.startsWith("/api/admin/fandom-requests")
      )
        return await catalogueAdmin(request, env, person);
      if (path === "/api/fandoms/activate")
        return await catalogueMember(request, env, person);
      if (path.startsWith("/api/admin/"))
        return await admin(request, env, person);
      if (path === "/api/onboarding/username" && request.method === "GET") {
        if (!person) throw new HttpError(401, "Please sign in.");
        const username = (url.searchParams.get("username") || "").toLowerCase();
        if (!/^[a-z0-9_]{3,24}$/.test(username)) return json({ available: false, reason: "Use 3–24 letters, numbers or underscores." });
        const reserved = ["admin", "administrator", "support", "moderator", "fanverse", "settings", "api"];
        const taken = reserved.includes(username) || Boolean(await db.prepare("SELECT user_id FROM profiles WHERE username=? AND user_id!=?").bind(username, viewer).first());
        return json({ available: !taken, reason: taken ? "That username is taken. Try another." : "That username is available." });
      }
      if (path === "/api/onboarding" && request.method === "POST") {
        if (!person) throw new HttpError(401, "Please sign in.");
        const value = await body(request), name = text(value.displayName, "Name", 40), username = text(value.username, "Username", 24).toLowerCase();
        const dob = typeof value.dateOfBirth === "string" ? value.dateOfBirth : "";
        const date = new Date(dob + "T00:00:00Z"), today = new Date().toISOString().slice(0,10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== dob || dob >= today || dob < "1900-01-01") throw new HttpError(400,"Enter a valid date of birth.");
        if (!/^[a-z0-9_]{3,24}$/.test(username) || ["admin", "administrator", "support", "moderator", "fanverse", "settings", "api"].includes(username)) throw new HttpError(400,"Choose a valid username: 3–24 letters, numbers or underscores.");
        try {
          await db.batch([
            db.prepare("UPDATE profiles SET username=?,display_name=? WHERE user_id=?").bind(username,name,viewer),
            db.prepare("INSERT INTO account_onboarding(user_id,date_of_birth) VALUES(?,?) ON CONFLICT(user_id) DO NOTHING").bind(viewer,dob),
          ]);
        } catch (error) {
          if (String(error).includes("UNIQUE")) throw new HttpError(409,"That username was just taken. Please choose another.");
          if (String(error).includes("no such table")) throw new HttpError(503,"Onboarding database setup is pending. Please try again shortly.");
          throw error;
        }
        return json({ok:true});
      }
      if (path === "/api/me" && request.method === "PATCH") {
        const value = await body(request),
          name = text(value.displayName, "Display name", 40),
          bio = text(value.bio ?? "", "Bio", 180, false),
          username = text(value.username, "Username", 24).toLowerCase();
        if (!/^[a-z0-9_]{3,24}$/.test(username))
          throw new HttpError(
            400,
            "Username must be 3–24 letters, numbers or underscores.",
          );
        const exists = await db
          .prepare(
            "SELECT user_id FROM profiles WHERE username=? AND user_id!=?",
          )
          .bind(username, viewer)
          .first();
        if (exists) throw new HttpError(409, "That username is taken.");
        try {
          await db
            .prepare(
              "UPDATE profiles SET username=?,display_name=?,bio=? WHERE user_id=?",
            )
            .bind(username, name, bio, viewer)
            .run();
        } catch (error) {
          if (String(error).includes("UNIQUE"))
            throw new HttpError(409, "That username is taken.");
          throw error;
        }
        return json({ ok: true });
      }
      if (path === "/api/posts" && request.method === "POST") {
        const value = await body(request),
          content = text(value.text, "Post", 500),
          fandom = (await resolveFandom(db, text(value.fandom, "Fandom", 100)))
            .id;
        const result = await db
          .prepare(
            "INSERT INTO posts(user_id,fandom_id,text) VALUES(?,?,?) RETURNING id",
          )
          .bind(viewer, fandom, content)
          .first();
        return json(result, 201);
      }
      const membership = path.match(/^\/api\/memberships\/([a-zA-Z0-9_-]+)$/);
      if (membership && ["PUT", "DELETE"].includes(request.method)) {
        const memberFandom =
          request.method === "PUT"
            ? (await resolveFandom(db, membership[1])).id
            : membership[1];
        await db
          .prepare(
            request.method === "PUT"
              ? "INSERT OR IGNORE INTO fandom_memberships(user_id,fandom_id) VALUES(?,?)"
              : "DELETE FROM fandom_memberships WHERE user_id=? AND fandom_id=?",
          )
          .bind(viewer, memberFandom)
          .run();
        return json({ ok: true });
      }
      const follow = path.match(/^\/api\/follows\/([^/]+)$/),
        block = path.match(/^\/api\/blocks\/([^/]+)$/);
      if ((follow || block) && ["PUT", "DELETE"].includes(request.method)) {
        const target = decodeURIComponent((follow || block)![1]);
        if (target === viewer)
          throw new HttpError(400, "Choose another account.");
        if (
          !(await db
            .prepare(
              "SELECT user_id FROM profiles WHERE user_id=? AND status='active'",
            )
            .bind(target)
            .first())
        )
          throw new HttpError(404, "Account not found.");
        if (
          follow &&
          request.method === "PUT" &&
          (await db
            .prepare(
              "SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=?) OR (user_id=? AND blocked_id=?)",
            )
            .bind(viewer, target, target, viewer)
            .first())
        )
          throw new HttpError(404, "Account not found.");
        const table = follow ? "follows" : "blocks",
          column = follow ? "following_id" : "blocked_id";
        const statement = db
          .prepare(
            request.method === "PUT"
              ? `INSERT OR IGNORE INTO ${table}(user_id,${column}) VALUES(?,?)`
              : `DELETE FROM ${table} WHERE user_id=? AND ${column}=?`,
          )
          .bind(viewer, target);
        if (block && request.method === "PUT")
          await db.batch([
            statement,
            db
              .prepare(
                "DELETE FROM follows WHERE (user_id=? AND following_id=?) OR (user_id=? AND following_id=?)",
              )
              .bind(viewer, target, target, viewer),
          ]);
        else await statement.run();
        return json({ ok: true });
      }
      const postPath = path.match(/^\/api\/posts\/(\d+)$/);
      if (postPath && ["PATCH", "DELETE"].includes(request.method)) {
        const id = Number(postPath[1]),
          post = await visiblePost(env, id, viewer);
        if (post.user_id !== viewer)
          throw new HttpError(403, "You can only change your own post.");
        if (request.method === "PATCH") {
          const value = await body(request),
            content = text(value.text, "Post", 500);
          await db
            .prepare(
              "UPDATE posts SET text=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND user_id=? AND status='published'",
            )
            .bind(content, id, viewer)
            .run();
        } else
          await db
            .prepare(
              "UPDATE posts SET status='deleted' WHERE id=? AND user_id=?",
            )
            .bind(id, viewer)
            .run();
        return json({ ok: true });
      }
      const activity = path.match(
        /^\/api\/posts\/(\d+)\/(likes|bookmarks|reports|replies)$/,
      );
      if (activity) {
        const id = Number(activity[1]),
          kind = activity[2];
        await visiblePost(env, id, viewer);
        if (
          ["likes", "bookmarks"].includes(kind) &&
          ["PUT", "DELETE"].includes(request.method)
        ) {
          const table = kind === "likes" ? "post_likes" : "post_bookmarks";
          await db
            .prepare(
              request.method === "PUT"
                ? `INSERT OR IGNORE INTO ${table}(user_id,post_id) VALUES(?,?)`
                : `DELETE FROM ${table} WHERE user_id=? AND post_id=?`,
            )
            .bind(viewer, id)
            .run();
          return json({ ok: true });
        }
        if (kind === "replies" && request.method === "POST") {
          const value = await body(request),
            content = text(value.text, "Reply", 500);
          const result = await db
            .prepare(
              "INSERT INTO replies(post_id,user_id,text) VALUES(?,?,?) RETURNING id",
            )
            .bind(id, viewer, content)
            .first();
          return json(result, 201);
        }
        if (kind === "reports" && request.method === "POST") {
          const value = await body(request),
            reason = text(value.reason, "Reason", 500);
          await db
            .prepare(
              "INSERT OR IGNORE INTO reports(reporter_id,post_id,reason) VALUES(?,?,?)",
            )
            .bind(viewer, id, reason)
            .run();
          return json({ ok: true });
        }
      }
      const replyDelete = path.match(/^\/api\/replies\/(\d+)$/);
      if (replyDelete && request.method === "DELETE") {
        const id = Number(replyDelete[1]);
        const row = await db
          .prepare(
            "SELECT user_id,post_id FROM replies WHERE id=? AND status='published'",
          )
          .bind(id)
          .first<{ user_id: string; post_id: number }>();
        if (!row) throw new HttpError(404, "Reply not found.");
        if (row.user_id !== viewer)
          throw new HttpError(403, "You can only delete your own reply.");
        await db
          .prepare(
            "UPDATE replies SET status='deleted' WHERE id=? AND user_id=?",
          )
          .bind(id, viewer)
          .run();
        return json({ ok: true });
      }
      throw new HttpError(404, "Endpoint not found.");
    } catch (error) {
      if (error instanceof HttpError)
        return json({ error: error.message }, error.status);
      console.error(
        "Community API request failed",
        new URL(request.url).pathname,
      );
      return json(
        { error: "The request could not be completed. Please try again." },
        500,
      );
    }
  },
};
