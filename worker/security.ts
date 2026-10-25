import { createAuth } from "./auth";
import { HttpError } from "./http";
import type { Env } from "./types";
export interface ProfileRow {
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  role: "member" | "moderator" | "admin";
  status: "active" | "suspended";
}
export async function identity(request: Request, env: Env, required = true) {
  const session = await createAuth(env).api.getSession({
    headers: request.headers,
  });
  if (!session) {
    if (required) throw new HttpError(401, "Please sign in.");
    return null;
  }
  const id = session.user.id;
  await env
    .DB!.prepare(
      "INSERT OR IGNORE INTO profiles(user_id,username,display_name) VALUES(?,?,?)",
    )
    .bind(
      id,
      "fan_" + id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20),
      session.user.name.slice(0, 40),
    )
    .run();
  const profile = await env
    .DB!.prepare("SELECT * FROM profiles WHERE user_id=?")
    .bind(id)
    .first<ProfileRow>();
  if (!profile || profile.status !== "active")
    throw new HttpError(403, "This account is suspended.");
  return profile;
}
export function requireStaff(profile: ProfileRow) {
  if (!["admin", "moderator"].includes(profile.role))
    throw new HttpError(403, "Moderator access is required.");
}
export function requireAdmin(profile: ProfileRow) {
  if (profile.role !== "admin")
    throw new HttpError(403, "Administrator access is required.");
}
export async function throttle(env: Env, profile: ProfileRow) {
  const window = Math.floor(Date.now() / 60000);
  const row = await env
    .DB!.prepare(
      "INSERT INTO app_rate_limits(key,count,window) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count",
    )
    .bind(profile.user_id, window)
    .first<{ count: number }>();
  if (!row || row.count > 30)
    throw new HttpError(429, "Too many changes. Please wait a minute.");
}
export function checkOrigin(request: Request, env: Env) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const allowed = new URL(env.BETTER_AUTH_URL!).origin;
  if (request.headers.get("origin") !== allowed)
    throw new HttpError(403, "Request origin is not allowed.");
}
export async function visiblePost(env: Env, id: number, viewer: string | null) {
  const row = await env
    .DB!.prepare(
      `SELECT p.* FROM posts p JOIN profiles a ON a.user_id=p.user_id JOIN fandoms directory ON directory.id=p.fandom_id AND directory.status='active' WHERE p.id=? AND p.status='published' AND a.status='active' AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=p.user_id) OR (b.user_id=p.user_id AND b.blocked_id=?))`,
    )
    .bind(id, viewer, viewer)
    .first<{ id: number; user_id: string }>();
  if (!row) throw new HttpError(404, "Post not found.");
  return row;
}
