import { useEffect, useState } from "react";
import { api, type LiveProfile, type Page } from "../api";
import { AdminNavigation } from "./AdminNavigation";
type Row = {
  id?: string;
  qid?: string;
  wikidata_id?: string;
  name: string;
  description: string;
  kind?: string;
  source_kind?: string;
  status: string;
};
export function FandomAdmin({
  profile,
  section,
}: {
  profile: LiveProfile;
  section: string;
}) {
  const reviews = section === "fandom-requests",
    [rows, setRows] = useState<Row[]>([]),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [next, setNext] = useState<string | number | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [action, setAction] = useState<{ row: Row; status: string } | null>(null);
  function path(cursor?: string | number | null) {
    const params = new URLSearchParams();
    if (search && !reviews) params.set("q", search);
    if (cursor) params.set("after", String(cursor));
    return "/api/admin/" + section + "?" + params;
  }
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError("");
    setRows([]);
    setNext(null);
    api<Page<Row>>(path())
      .then((data) => {
        if (!cancelled) {
          setRows(data.items);
          setNext(data.next);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section, search, revision]);
  return (
    <div className="admin-panel">
      <div className="admin-heading">
        <h2>{reviews ? "Fandom request review" : "Fandom directory"}</h2>
        <span className="role-badge">{profile.role}</span>
      </div>
      <AdminNavigation role={profile.role} section={section} />
      <p className="local-explainer">
        {reviews
          ? "Only unclear catalogue subjects enter this queue. Recognised artists, TV series and films use their canonical ID."
          : "One platform-managed fandom per Wikidata subject. Archiving does not free its identity for a duplicate."}
      </p>
      {!reviews && (
        <form
          className="admin-search"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query);
          }}
        >
          <input
            aria-label="Find a fandom"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={100}
            placeholder="Search directory names"
          />
          <button className="secondary">Search</button>
        </form>
      )}
      {error && (
        <p className="save-error" role="alert">
          {error}
        </p>
      )}
      {action && (
        <form
          className="admin-action"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget),
              reason = String(form.get("reason") || "");
            setBusy(true);
            setError("");
            try {
              await api(
                "/api/admin/" +
                  section +
                  "/" +
                  (reviews
                    ? action.row.qid
                    : encodeURIComponent(action.row.id!)) +
                  (action.status === "merge" ? "/merge" : ""),
                action.status === "merge" ? "POST" : "PATCH",
                reviews
                  ? {
                      status: action.status,
                      note: reason,
                      kind: form.get("kind"),
                    }
                  : action.status === "merge"
                    ? { targetId: form.get("targetId"), reason }
                    : { status: action.status, reason },
              );
              setAction(null);
              setRevision((n) => n + 1);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>
            {action.status.charAt(0).toUpperCase() + action.status.slice(1)}:{" "}
            {action.row.name}
          </h3>
          {reviews && action.status === "approved" && (
            <label>
              Verified subject type
              <select name="kind" required>
                <option value="">Choose after checking the source</option>
                <option value="artist">Artist / performer</option>
                <option value="tv">TV series</option>
                <option value="film">Film</option>
              </select>
            </label>
          )}
          {action.status === "merge" && (
            <label>
              Target canonical fandom ID
              <input
                name="targetId"
                required
                maxLength={100}
                placeholder="The active fandom to keep"
              />
              <small>
                Posts and memberships move to the target. Old links redirect
                there.
              </small>
            </label>
          )}
          <label>
            Reason for the audit log
            <textarea name="reason" maxLength={500} required />
          </label>
          <div>
            <button
              className="secondary"
              type="button"
              onClick={() => setAction(null)}
            >
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              Confirm decision
            </button>
          </div>
        </form>
      )}
      {busy && <p className="live-empty">Loading directory records…</p>}
      {rows.map((row) => (
        <article className="admin-row" key={row.id || row.qid}>
          <div className="admin-row-title">
            <strong>{row.name}</strong>
            <span className="role-badge">
              {row.kind || row.source_kind} · {row.status}
            </span>
          </div>
          <p>{row.description}</p>
          {(row.qid || row.wikidata_id) && (
            <a
              className="catalogue-source"
              target="_blank"
              rel="noreferrer"
              href={
                "https://www.wikidata.org/wiki/" + (row.qid || row.wikidata_id)
              }
            >
              Check subject {row.qid || row.wikidata_id} ↗
            </a>
          )}
          {profile.role === "admin" ? (
            <div className="admin-row-actions">
              {reviews ? (
                <>
                  <button
                    className="secondary"
                    onClick={() => setAction({ row, status: "approved" })}
                  >
                    Approve subject
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setAction({ row, status: "rejected" })}
                  >
                    Reject
                  </button>
                </>
              ) : (
                row.status !== "merged" && (
                  <button
                    className="secondary"
                    onClick={() =>
                      setAction({
                        row,
                        status: row.status === "active" ? "archived" : "active",
                      })
                    }
                  >
                    {row.status === "active"
                      ? "Archive fandom"
                      : "Restore fandom"}
                  </button>
                )
              )}
              {!reviews && row.status !== "merged" && row.kind !== "hub" && (
                <button
                  className="secondary"
                  onClick={() => setAction({ row, status: "merge" })}
                >
                  Merge duplicate
                </button>
              )}
            </div>
          ) : (
            <small>
              Administrator approval is required for directory changes.
            </small>
          )}
        </article>
      ))}
      {!busy && !error && rows.length === 0 && (
        <div className="empty-state">
          <h3>
            {reviews ? "No subjects awaiting review" : "No matching fandoms"}
          </h3>
        </div>
      )}
      {next && (
        <button
          className="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const data = await api<Page<Row>>(path(next));
              setRows((r) => [...r, ...data.items]);
              setNext(data.next);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Load more
        </button>
      )}
    </div>
  );
}
