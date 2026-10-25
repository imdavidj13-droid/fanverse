import {
  normalizeName,
  subjectSlug,
  type CatalogueSubject,
} from "../shared/catalogue";
import { WikidataClient } from "./wikidata";
import { body, HttpError, json, limit, text } from "./http";
import { requireAdmin, requireStaff, type ProfileRow } from "./security";
import type { Env } from "./types";
export interface FandomRow {
  id: string;
  wikidata_id: string | null;
  slug: string;
  name: string;
  description: string;
  kind: string;
  status: string;
  merged_into: string | null;
}
export async function resolveFandom(
  db: D1Database,
  id: string,
): Promise<FandomRow> {
  let row = await db
    .prepare("SELECT * FROM fandoms WHERE id=? OR slug=?")
    .bind(id, id)
    .first<FandomRow>();
  const seen = new Set<string>();
  while (row?.status === "merged" && row.merged_into) {
    if (seen.has(row.id) || seen.size > 8)
      throw new HttpError(
        409,
        "This fandom redirect needs administrator review.",
      );
    seen.add(row.id);
    row = await db
      .prepare("SELECT * FROM fandoms WHERE id=?")
      .bind(row.merged_into)
      .first<FandomRow>();
  }
  if (!row || row.status !== "active")
    throw new HttpError(404, "Fandom not available.");
  return row;
}
export async function byQid(db: D1Database, qid: string) {
  return db
    .prepare(
      "SELECT f.* FROM fandoms f JOIN fandom_source_ids s ON s.fandom_id=f.id WHERE s.qid=?",
    )
    .bind(qid)
    .first<FandomRow>();
}
export function creationStatements(
  db: D1Database,
  subject: CatalogueSubject,
  actor: ProfileRow,
  kind: string = subject.kind,
  requestedId = subject.qid,
) {
  const id = "wd-" + subject.qid,
    slug = subjectSlug(subject.name, subject.qid),
    aliases = Array.from(new Set([subject.name, ...subject.aliases]));
  return [
    db
      .prepare(
        "INSERT OR IGNORE INTO fandoms(id,wikidata_id,slug,name,description,kind,source_revision,created_by) VALUES(?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        subject.qid,
        slug,
        subject.name,
        subject.description,
        kind,
        subject.revision,
        actor.user_id,
      ),
    db
      .prepare(
        "INSERT OR IGNORE INTO fandom_source_ids(qid,fandom_id) VALUES(?,?)",
      )
      .bind(subject.qid, id),
    ...(requestedId !== subject.qid
      ? [
          db
            .prepare(
              "INSERT OR IGNORE INTO fandom_source_ids(qid,fandom_id) VALUES(?,?)",
            )
            .bind(requestedId, id),
        ]
      : []),
    ...aliases.map((alias) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO fandom_aliases(fandom_id,alias,normalized_alias) VALUES(?,?,?)",
        )
        .bind(id, alias, normalizeName(alias)),
    ),
  ];
}
export async function cataloguePublic(request: Request, env: Env) {
  const url = new URL(request.url),
    path = url.pathname,
    client = new WikidataClient(env);
  if (request.method !== "GET")
    throw new HttpError(405, "Catalogue lookups are read-only.");
  const available = env.DB
    ? await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='fandoms'",
      )
        .first()
        .catch(() => null)
    : null;
  async function decorate(subject: CatalogueSubject) {
    const existing = available ? await byQid(env.DB!, subject.qid) : null;
    return {
      ...subject,
      existing: existing
        ? { id: existing.id, slug: existing.slug, status: existing.status }
        : null,
    };
  }
  if (path === "/api/catalogue/search") {
    const query = text(url.searchParams.get("q"), "Search", 100);
    if (query.length < 2)
      throw new HttpError(400, "Enter at least two characters.");
    const subjects = await client.search(query);
    const items = [];
    for (const subject of subjects) items.push(await decorate(subject));
    return json({
      items,
      source: "wikidata",
      directoryConnected: Boolean(available),
    });
  }
  const match = path.match(/^\/api\/catalogue\/subjects\/(Q[1-9]\d{0,12})$/);
  if (match) return json(await decorate(await client.get(match[1])));
  throw new HttpError(404, "Catalogue endpoint not found.");
}
export async function catalogueMember(
  request: Request,
  env: Env,
  actor: ProfileRow,
) {
  const db = env.DB!,
    path = new URL(request.url).pathname;
  if (request.method === "POST" && path === "/api/fandoms/activate") {
    const value = await body(request),
      qid = text(value.qid, "Catalogue ID", 14);
    const existing = await byQid(db, qid);
    if (existing) {
      const fandom = await resolveFandom(db, existing.id);
      return json({ fandom, created: false });
    }
    const subject = await new WikidataClient(env).get(qid),
      canonical = await byQid(db, subject.qid);
    if (canonical)
      return json({
        fandom: await resolveFandom(db, canonical.id),
        created: false,
      });
    const decision = await db
      .prepare(
        "SELECT status FROM fandom_requests WHERE qid IN (?,?) ORDER BY CASE status WHEN 'rejected' THEN 0 ELSE 1 END LIMIT 1",
      )
      .bind(qid, subject.qid)
      .first<{ status: string }>();
    if (decision?.status === "rejected")
      throw new HttpError(
        409,
        "This subject has already been declined by an administrator.",
      );
    if (decision?.status === "pending")
      return json({ review: true, status: "pending" }, 202);
    if (subject.kind === "unsupported")
      throw new HttpError(
        400,
        "This item belongs inside its artist fandom rather than a separate community.",
      );
    if (subject.kind === "review") {
      await db
        .prepare(
          "INSERT OR IGNORE INTO fandom_requests(qid,name,description,source_kind,requested_by) VALUES(?,?,?,?,?)",
        )
        .bind(
          subject.qid,
          subject.name,
          subject.description,
          subject.kind,
          actor.user_id,
        )
        .run();
      const review = await db
        .prepare("SELECT status FROM fandom_requests WHERE qid=?")
        .bind(subject.qid)
        .first();
      return json({ review: true, status: review?.status }, 202);
    }
    const outcome = await db.batch([
      ...creationStatements(db, subject, actor, subject.kind, qid),
      db
        .prepare(
          "INSERT INTO audit_log(actor_id,action,target_type,target_id,reason) VALUES(?,?,?,?,?)",
        )
        .bind(
          actor.user_id,
          "fandom.activated",
          "fandom",
          "wd-" + subject.qid,
          "Recognised Wikidata subject " + subject.qid,
        ),
    ]);
    const fandom = await byQid(db, subject.qid);
    return json(
      { fandom, created: outcome[0].meta.changes === 1 },
      outcome[0].meta.changes === 1 ? 201 : 200,
    );
  }
  throw new HttpError(404, "Fandom endpoint not found.");
}
export async function catalogueAdmin(
  request: Request,
  env: Env,
  actor: ProfileRow,
) {
  requireStaff(actor);
  const db = env.DB!,
    url = new URL(request.url),
    path = url.pathname;
  if (path === "/api/admin/fandoms" && request.method === "GET") {
    const q = (url.searchParams.get("q") || "")
        .slice(0, 100)
        .replace(/[\\%_]/g, "\\$&"),
      after = url.searchParams.get("after") || "",
      n = limit(url);
    const rows = await db
      .prepare(
        "SELECT * FROM fandoms WHERE id>? AND name LIKE ? ESCAPE '\\' ORDER BY id LIMIT ?",
      )
      .bind(after, "%" + q + "%", n + 1)
      .all();
    return json({
      items: rows.results.slice(0, n),
      next: rows.results.length > n ? rows.results[n - 1].id : null,
    });
  }
  if (path === "/api/admin/fandom-requests" && request.method === "GET") {
    const n = limit(url),
      after = url.searchParams.get("after") || "";
    const rows = await db
      .prepare(
        "SELECT * FROM fandom_requests WHERE status='pending' AND qid>? ORDER BY qid LIMIT ?",
      )
      .bind(after, n + 1)
      .all();
    return json({
      items: rows.results.slice(0, n),
      next: rows.results.length > n ? rows.results[n - 1].qid : null,
    });
  }
  const review = path.match(
    /^\/api\/admin\/fandom-requests\/(Q[1-9]\d{0,12})$/,
  );
  if (review && request.method === "PATCH") {
    requireAdmin(actor);
    const value = await body(request),
      note = text(value.note, "Review note", 500);
    if (!["approved", "rejected"].includes(String(value.status)))
      throw new HttpError(400, "Choose approved or rejected.");
    const row = await db
      .prepare("SELECT * FROM fandom_requests WHERE qid=? AND status='pending'")
      .bind(review[1])
      .first();
    if (!row) throw new HttpError(409, "This request is already reviewed.");
    const statements: D1PreparedStatement[] = [];
    let fandomId: string | null = null;
    if (value.status === "approved") {
      const subject = await new WikidataClient(env).get(review[1]);
      if (subject.kind === "unsupported")
        throw new HttpError(400, "This item cannot be a standalone fandom.");
      const kind =
        subject.kind === "review" ? String(value.kind) : subject.kind;
      if (!["artist", "tv", "film"].includes(kind))
        throw new HttpError(400, "Choose the verified subject type.");
      const existing = await byQid(db, subject.qid);
      if (existing) fandomId = (await resolveFandom(db, existing.id)).id;
      else {
        fandomId = "wd-" + subject.qid;
        statements.push(
          ...creationStatements(db, subject, actor, kind, review[1]),
        );
      }
    }
    statements.push(
      db
        .prepare(
          "UPDATE fandom_requests SET status=?,reviewed_by=?,review_note=?,fandom_id=? WHERE qid=? AND status='pending'",
        )
        .bind(value.status, actor.user_id, note, fandomId, review[1]),
      db
        .prepare(
          "INSERT INTO audit_log(actor_id,action,target_type,target_id,reason) VALUES(?,?,?,?,?)",
        )
        .bind(
          actor.user_id,
          "fandom_request." + value.status,
          "catalogue",
          review[1],
          note,
        ),
    );
    await db.batch(statements);
    return json({ ok: true, fandomId });
  }
  const subject = path.match(/^\/api\/admin\/fandoms\/([^/]+)$/);
  if (subject && request.method === "PATCH") {
    requireAdmin(actor);
    const value = await body(request),
      reason = text(value.reason, "Reason", 500),
      id = decodeURIComponent(subject[1]);
    if (!["active", "archived"].includes(String(value.status)))
      throw new HttpError(400, "Choose active or archived.");
    const row = await db
      .prepare("SELECT status FROM fandoms WHERE id=?")
      .bind(id)
      .first<{ status: string }>();
    if (!row || row.status === "merged")
      throw new HttpError(404, "Fandom not available.");
    await db.batch([
      db
        .prepare("UPDATE fandoms SET status=? WHERE id=?")
        .bind(value.status, id),
      db
        .prepare(
          "INSERT INTO audit_log(actor_id,action,target_type,target_id,reason) VALUES(?,?,?,?,?)",
        )
        .bind(actor.user_id, "fandom." + value.status, "fandom", id, reason),
    ]);
    return json({ ok: true });
  }
  const merge = path.match(/^\/api\/admin\/fandoms\/([^/]+)\/merge$/);
  if (merge && request.method === "POST") {
    requireAdmin(actor);
    const value = await body(request),
      reason = text(value.reason, "Reason", 500),
      sourceId = decodeURIComponent(merge[1]),
      targetId = text(value.targetId, "Target fandom ID", 100);
    const source = await db
      .prepare("SELECT * FROM fandoms WHERE id=?")
      .bind(sourceId)
      .first<FandomRow>();
    const target = await resolveFandom(db, targetId);
    if (
      !source ||
      source.status === "merged" ||
      source.id === target.id ||
      source.kind === "hub" ||
      source.kind !== target.kind
    )
      throw new HttpError(
        400,
        "Choose two different subject fandoms of the same type.",
      );
    const partyStatements = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='listening_parties'").first()
      ? [db.prepare("UPDATE listening_parties SET fandom_id=? WHERE fandom_id=?").bind(target.id,source.id)] : [];
    await db.batch([
      ...partyStatements,
      db
        .prepare(
          "INSERT OR IGNORE INTO fandom_memberships(user_id,fandom_id) SELECT user_id,? FROM fandom_memberships WHERE fandom_id=?",
        )
        .bind(target.id, source.id),
      db
        .prepare("DELETE FROM fandom_memberships WHERE fandom_id=?")
        .bind(source.id),
      db
        .prepare("UPDATE posts SET fandom_id=? WHERE fandom_id=?")
        .bind(target.id, source.id),
      db
        .prepare("UPDATE fandom_source_ids SET fandom_id=? WHERE fandom_id=?")
        .bind(target.id, source.id),
      db
        .prepare(
          "INSERT OR IGNORE INTO fandom_aliases(fandom_id,alias,normalized_alias) SELECT ?,alias,normalized_alias FROM fandom_aliases WHERE fandom_id=?",
        )
        .bind(target.id, source.id),
      db
        .prepare("DELETE FROM fandom_aliases WHERE fandom_id=?")
        .bind(source.id),
      db
        .prepare("UPDATE fandom_requests SET fandom_id=? WHERE fandom_id=?")
        .bind(target.id, source.id),
      db
        .prepare("UPDATE fandoms SET status='merged',merged_into=? WHERE id=?")
        .bind(target.id, source.id),
      db
        .prepare(
          "UPDATE fandoms SET merged_into=? WHERE merged_into=? AND status='merged'",
        )
        .bind(target.id, source.id),
      db
        .prepare(
          "INSERT INTO audit_log(actor_id,action,target_type,target_id,reason) VALUES(?,?,?,?,?)",
        )
        .bind(
          actor.user_id,
          "fandom.merged",
          "fandom",
          source.id,
          "Into " + target.id + ": " + reason,
        ),
    ]);
    return json({ ok: true, fandom: target });
  }
  throw new HttpError(404, "Fandom administration endpoint not found.");
}
