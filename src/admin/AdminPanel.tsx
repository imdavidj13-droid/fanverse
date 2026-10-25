import { useEffect, useState } from "react";
import { api, type LiveProfile, type Page } from "../api";
import { AdminNavigation } from "./AdminNavigation";
import { FandomAdmin } from "./FandomAdmin";
type Row = Record<string, string | number | null>;

export function AdminPanel({ profile }: { profile: LiveProfile }) {
  const section = location.pathname.split("/")[2] || "overview";
  const [rows, setRows] = useState<Row[]>([]),
    [overview, setOverview] = useState<Record<string, number> | null>(null),
    [next, setNext] = useState<string | number | null>(null),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [reportStatus, setReportStatus] = useState("open"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [action, setAction] = useState<{
      path: string;
      data: Record<string, string>;
      label: string;
    } | null>(null);
  const staff = profile.role !== "member",
    admin = profile.role === "admin";
  function path(cursor?: string | number | null) {
    const params = new URLSearchParams();
    if (section === "users") params.set("q", search);
    if (section === "reports") params.set("status", reportStatus);
    if (cursor)
      params.set(section === "users" ? "after" : "before", String(cursor));
    return "/api/admin/" + section + "?" + params;
  }
  useEffect(() => {
    let cancelled = false;
    if (!staff || ["fandoms", "fandom-requests"].includes(section)) return;
    setBusy(true);
    setError("");
    setRows([]);
    setOverview(null);
    setNext(null);
    (async () => {
      try {
        const value = await api<Page<Row> & Record<string, number>>(path());
        if (!cancelled) {
          if (section === "overview") setOverview(value);
          else {
            setRows(value.items);
            setNext(value.next);
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section, search, reportStatus, refresh, staff]);
  if (!staff)
    return (
      <div className="empty-state">
        <h2>Staff access required</h2>
        <p>
          Your account does not have moderator or administrator permissions.
          Permissions are checked by the server.
        </p>
      </div>
    );
  if (["fandoms", "fandom-requests"].includes(section))
    return <FandomAdmin profile={profile} section={section} />;
  return (
    <div className="admin-panel">
      <div className="admin-heading">
        <h2>Community control centre</h2>
        <span className="role-badge">{profile.role}</span>
      </div>
      <AdminNavigation role={profile.role} section={section} />
      {error && (
        <div className="save-error" role="alert">
          {error}
        </div>
      )}
      {busy && <p>Loading administration data…</p>}
      {section === "overview" && overview && (
        <>
          <div className="admin-metrics">
            {[
              ["users", "Accounts"],
              ["posts", "Published posts"],
              ["reports", "Open reports"],
              ["suspended", "Suspended accounts"],
            ].map(([key, label]) => (
              <section key={key}>
                <strong>{overview[key]}</strong>
                <span>{label}</span>
              </section>
            ))}
          </div>
          <div className="admin-guide">
            <h3>Start with the reports queue</h3>
            <p>
              Review reported content, check context, then hide a post or
              dismiss the report with a reason. Hiding content is separate from
              resolving the report.
            </p>
            <a className="primary" href="/admin/reports">
              Review reports
            </a>
            <h3>Staff permissions</h3>
            <p>
              Moderators can review reports and moderate member posts.
              Administrators can also manage accounts, assign roles and read the
              audit log. Administrator access cannot be removed through this
              screen.
            </p>
            <h3>Next administration stages</h3>
            <p>
              Community settings, reply moderation, appeals, spam detection,
              media review and email controls will be added in stages. Messaging
              and media storage are not enabled in this shared backend yet.
            </p>
          </div>
        </>
      )}
      {section === "users" && (
        <form
          className="admin-search"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query);
          }}
        >
          <label className="sr-only" htmlFor="admin-user-search">
            Find an account
          </label>
          <input
            id="admin-user-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username or display name"
            maxLength={100}
          />
          <button className="secondary">Search</button>
        </form>
      )}
      {section === "reports" && (
        <label className="admin-filter">
          Report status
          <select
            value={reportStatus}
            onChange={(e) => setReportStatus(e.target.value)}
          >
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </label>
      )}
      {action && (
        <form
          className="admin-action"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget),
              reason = String(data.get("reason") || "").trim();
            if (!reason) return;
            setBusy(true);
            setError("");
            try {
              await api(action.path, "PATCH", {
                ...action.data,
                [action.path.includes("/reports/") ? "note" : "reason"]: reason,
              });
              setAction(null);
              setRefresh((n) => n + 1);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>{action.label}</h3>
          <label>
            Reason for the audit log
            <textarea
              name="reason"
              required
              maxLength={500}
              placeholder="Explain the decision and relevant context."
            />
          </label>
          <p>
            This action affects the shared community and is recorded with your
            account.
          </p>
          <div>
            <button
              type="button"
              className="secondary"
              onClick={() => setAction(null)}
            >
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              Confirm action
            </button>
          </div>
        </form>
      )}
      <div className="admin-list">
        {rows.map((row) => (
          <article className="admin-row" key={String(row.id || row.user_id)}>
            {section === "users" ? (
              <>
                <div className="admin-row-title">
                  <strong>{row.display_name}</strong>
                  <span>@{row.username}</span>
                  <span className="role-badge">
                    {row.role} · {row.status}
                  </span>
                </div>
                {admin && row.user_id !== profile.user_id && (
                  <div className="admin-row-actions">
                    {row.role === "member" && (
                      <button
                        className="secondary"
                        onClick={() =>
                          setAction({
                            path: "/api/admin/users/" + row.user_id,
                            data: {
                              status:
                                row.status === "active"
                                  ? "suspended"
                                  : "active",
                            },
                            label:
                              (row.status === "active"
                                ? "Suspend"
                                : "Restore") +
                              " @" +
                              row.username,
                          })
                        }
                      >
                        {row.status === "active" ? "Suspend" : "Restore"}
                      </button>
                    )}
                    {row.role !== "admin" && (
                      <>
                        <button
                          className="secondary"
                          onClick={() =>
                            setAction({
                              path: "/api/admin/users/" + row.user_id,
                              data: {
                                role:
                                  row.role === "member"
                                    ? "moderator"
                                    : "member",
                              },
                              label:
                                (row.role === "member"
                                  ? "Make moderator: "
                                  : "Remove moderator: ") + row.username,
                            })
                          }
                        >
                          {row.role === "member"
                            ? "Make moderator"
                            : "Remove moderator"}
                        </button>
                        <button
                          className="secondary"
                          onClick={() =>
                            setAction({
                              path: "/api/admin/users/" + row.user_id,
                              data: { role: "admin" },
                              label:
                                "Grant administrator access to @" +
                                row.username,
                            })
                          }
                        >
                          Make administrator
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : section === "audit" ? (
              <>
                <div className="admin-row-title">
                  <strong>{row.action}</strong>
                  <span>@{row.actor_username}</span>
                </div>
                <p>
                  Target: {row.target_type} / {row.target_id}
                </p>
                <p>{row.reason}</p>
                <small>{row.created_at}</small>
              </>
            ) : (
              <>
                <div className="admin-row-title">
                  <strong>#{row.id}</strong>
                  <span>@{row.author_username || row.username}</span>
                  <span className="role-badge">
                    {section === "reports" ? row.post_status : row.status}
                  </span>
                </div>
                <p className="post-text">{row.text}</p>
                {section === "reports" && (
                  <>
                    <p className="report-reason">
                      <strong>Reported by @{row.reporter_username}:</strong>{" "}
                      {row.reason}
                    </p>
                    {row.review_note && <p>Review: {row.review_note}</p>}
                  </>
                )}
                <div className="admin-row-actions">
                  {((section === "posts" && row.status !== "deleted") ||
                    (section === "reports" &&
                      row.post_status !== "deleted")) && (
                    <button
                      className="secondary"
                      onClick={() => {
                        const hidden =
                          (section === "reports"
                            ? row.post_status
                            : row.status) === "hidden";
                        setAction({
                          path: "/api/admin/posts/" + (row.post_id || row.id),
                          data: { status: hidden ? "published" : "hidden" },
                          label: hidden
                            ? "Restore this post"
                            : "Hide this post",
                        });
                      }}
                    >
                      {(section === "reports"
                        ? row.post_status
                        : row.status) === "hidden"
                        ? "Restore post"
                        : "Hide post"}
                    </button>
                  )}
                  {section === "reports" && row.status === "open" && (
                    <>
                      <button
                        className="secondary"
                        onClick={() =>
                          setAction({
                            path: "/api/admin/reports/" + row.id,
                            data: { status: "resolved" },
                            label: "Resolve report #" + row.id,
                          })
                        }
                      >
                        Resolve
                      </button>
                      <button
                        className="secondary"
                        onClick={() =>
                          setAction({
                            path: "/api/admin/reports/" + row.id,
                            data: { status: "dismissed" },
                            label: "Dismiss report #" + row.id,
                          })
                        }
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                </div>
                <small>{row.created_at}</small>
              </>
            )}
          </article>
        ))}
      </div>
      {!busy && !error && section !== "overview" && rows.length === 0 && (
        <div className="empty-state">
          <h3>No matching records</h3>
          <p>This section uses real database records.</p>
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
