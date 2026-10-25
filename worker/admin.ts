import { body, HttpError, json, limit, pageCursor, text } from "./http";
import { requireAdmin, requireStaff, type ProfileRow } from "./security";
import type { Env } from "./types";
export async function admin(request: Request, env: Env, actor: ProfileRow) {
  requireStaff(actor);
  const db = env.DB!,
    url = new URL(request.url),
    path = url.pathname;
  if (request.method === "GET" && path === "/api/admin/overview") {
    const rows = await db.batch<{ total: number }>([
      db.prepare("SELECT COUNT(*) total FROM profiles"),
      db.prepare("SELECT COUNT(*) total FROM posts WHERE status='published'"),
      db.prepare("SELECT COUNT(*) total FROM reports WHERE status='open'"),
      db.prepare(
        "SELECT COUNT(*) total FROM profiles WHERE status='suspended'",
      ),
    ]);
    return json({
      role: actor.role,
      users: rows[0].results[0].total,
      posts: rows[1].results[0].total,
      reports: rows[2].results[0].total,
      suspended: rows[3].results[0].total,
    });
  }
  if (request.method === "GET" && path === "/api/admin/users") {
    const q = (url.searchParams.get("q") || "").slice(0, 100),
      n = limit(url),
      after = url.searchParams.get("after") || "";
    const rows = await db
      .prepare(
        `SELECT user_id,username,display_name,role,status,created_at FROM profiles WHERE user_id>? AND (username LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\') ORDER BY user_id LIMIT ?`,
      )
      .bind(after, "%" + escapeLike(q) + "%", "%" + escapeLike(q) + "%", n + 1)
      .all<ProfileRow>();
    return json({
      items: rows.results.slice(0, n),
      next: rows.results.length > n ? rows.results[n - 1].user_id : null,
    });
  }
  if (request.method === "GET" && path === "/api/admin/posts") {
    const n = limit(url),
      before = pageCursor(url);
    const rows = await db
      .prepare(
        "SELECT p.id,p.text,p.status,p.created_at,p.user_id,a.username,a.display_name FROM posts p JOIN profiles a ON a.user_id=p.user_id WHERE p.id<? ORDER BY p.id DESC LIMIT ?",
      )
      .bind(before, n + 1)
      .all();
    return json({
      items: rows.results.slice(0, n),
      next: rows.results.length > n ? rows.results[n - 1].id : null,
    });
  }
  if (request.method === "GET" && path === "/api/admin/reports") {
    const n = limit(url),
      before = pageCursor(url),
      status = url.searchParams.get("status") || "open";
    if (!["open", "resolved", "dismissed"].includes(status))
      throw new HttpError(400, "Unknown report status.");
    const rows = await db
      .prepare(
        "SELECT r.*,p.text,p.status post_status,a.username author_username,b.username reporter_username FROM reports r JOIN posts p ON p.id=r.post_id JOIN profiles a ON a.user_id=p.user_id JOIN profiles b ON b.user_id=r.reporter_id WHERE r.status=? AND r.id<? ORDER BY r.id DESC LIMIT ?",
      )
      .bind(status, before, n + 1)
      .all();
    return json({
      items: rows.results.slice(0, n),
      next: rows.results.length > n ? rows.results[n - 1].id : null,
    });
  }
  if (request.method === "GET" && path === "/api/admin/audit") {
    requireAdmin(actor);
    const n = limit(url),
      before = pageCursor(url);
    const rows = await db
      .prepare(
        "SELECT l.*,a.username actor_username FROM audit_log l JOIN profiles a ON a.user_id=l.actor_id WHERE l.id<? ORDER BY l.id DESC LIMIT ?",
      )
      .bind(before, n + 1)
      .all();
    return json({
      items: rows.results.slice(0, n),
      next: rows.results.length > n ? rows.results[n - 1].id : null,
    });
  }
  if (request.method === "PATCH" && /^\/api\/admin\/users\/[^/]+$/.test(path)) {
    requireAdmin(actor);
    const id = decodeURIComponent(path.split("/").pop()!);
    if (id === actor.user_id)
      throw new HttpError(
        400,
        "You cannot change your own access or suspend yourself.",
      );
    const target = await db
      .prepare("SELECT * FROM profiles WHERE user_id=?")
      .bind(id)
      .first<ProfileRow>();
    if (!target) throw new HttpError(404, "User not found.");
    const value = await body(request),
      reason = text(value.reason, "Reason", 500),
      status = value.status,
      role = value.role;
    if (role !== undefined && status !== undefined)
      throw new HttpError(400, "Change a role or account status separately.");
    let statement: D1PreparedStatement, action: string;
    if (role !== undefined) {
      if (target.role === "admin" && role !== "admin")
        throw new HttpError(
          400,
          "Administrator access removal requires the owner CLI.",
        );
      if (!["member", "moderator", "admin"].includes(String(role)))
        throw new HttpError(400, "Unknown role.");
      statement = db
        .prepare("UPDATE profiles SET role=? WHERE user_id=?")
        .bind(role, id);
      action = "user.role_changed";
    } else if (status !== undefined) {
      if (!["active", "suspended"].includes(String(status)))
        throw new HttpError(400, "Unknown status.");
      if (target.role !== "member")
        throw new HttpError(
          400,
          "Remove staff permissions before suspending an account.",
        );
      statement = db
        .prepare("UPDATE profiles SET status=? WHERE user_id=?")
        .bind(status, id);
      action = status === "suspended" ? "user.suspended" : "user.restored";
    } else throw new HttpError(400, "Choose a role or status.");
    const audit = db
      .prepare(
        "INSERT INTO audit_log(actor_id,action,target_type,target_id,reason) VALUES(?,?,?,?,?)",
      )
      .bind(actor.user_id, action, "user", id, reason);
    await db.batch([
      statement,
      db.prepare("DELETE FROM session WHERE userId=?").bind(id),
      audit,
    ]);
    return json({ ok: true });
  }
  if (request.method === "PATCH" && /^\/api\/admin\/posts\/\d+$/.test(path)) {
    const id = Number(path.split("/").pop()),
      value = await body(request),
      reason = text(value.reason, "Reason", 500),
      status = value.status;
    if (!["published", "hidden"].includes(String(status)))
      throw new HttpError(400, "Choose published or hidden.");
    const target = await db
      .prepare(
        "SELECT p.status,a.role FROM posts p JOIN profiles a ON a.user_id=p.user_id WHERE p.id=?",
      )
      .bind(id)
      .first<{ status: string; role: string }>();
    if (!target || target.status === "deleted")
      throw new HttpError(404, "Post not found.");
    if (actor.role !== "admin" && target.role !== "member")
      throw new HttpError(403, "An administrator must review staff content.");
    await db.batch([
      db.prepare("UPDATE posts SET status=? WHERE id=?").bind(status, id),
      db
        .prepare(
          "INSERT INTO audit_log(actor_id,action,target_type,target_id,reason) VALUES(?,?,?,?,?)",
        )
        .bind(
          actor.user_id,
          status === "hidden" ? "post.hidden" : "post.restored",
          "post",
          String(id),
          reason,
        ),
    ]);
    return json({ ok: true });
  }
  if (request.method === "PATCH" && /^\/api\/admin\/reports\/\d+$/.test(path)) {
    const id = Number(path.split("/").pop()),
      value = await body(request),
      note = text(value.note, "Review note", 500);
    if (!["resolved", "dismissed"].includes(String(value.status)))
      throw new HttpError(400, "Choose resolved or dismissed.");
    const exists = await db
      .prepare("SELECT id FROM reports WHERE id=? AND status='open'")
      .bind(id)
      .first();
    if (!exists)
      throw new HttpError(
        409,
        "This report is already reviewed or does not exist.",
      );
    await db.batch([
      db
        .prepare(
          "UPDATE reports SET status=?,reviewed_by=?,review_note=? WHERE id=? AND status='open'",
        )
        .bind(value.status, actor.user_id, note, id),
      db
        .prepare(
          "INSERT INTO audit_log(actor_id,action,target_type,target_id,reason) VALUES(?,?,?,?,?)",
        )
        .bind(
          actor.user_id,
          "report." + value.status,
          "report",
          String(id),
          note,
        ),
    ]);
    return json({ ok: true });
  }
  throw new HttpError(404, "Admin endpoint not found.");
}
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
