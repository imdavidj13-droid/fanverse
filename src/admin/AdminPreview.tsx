import { useState } from "react";
import { AdminNavigation } from "./AdminNavigation";
import { fandoms } from "../data";

type Entry = { id: string; name: string; detail: string; status: string };
type Preview = { reports: Entry[]; users: Entry[]; posts: Entry[]; fandoms: Entry[]; "fandom-requests": Entry[]; audit: Entry[] };
const key = "fanverse.admin-preview.v1";
function initial(): Preview {
  return {
    reports: [{ id: "report-1", name: "Repeated promotional replies", detail: "Sample report: a member reported the same link being posted repeatedly.", status: "open" }],
    users: [{ id: "fan-1", name: "@examplefan", detail: "Sample member account", status: "active" }],
    posts: [{ id: "post-1", name: "What song would you put first on the setlist?", detail: "Sample post by @examplefan", status: "published" }],
    fandoms: fandoms.map(f => ({ id: f.id, name: f.name, detail: f.description, status: "active" })),
    "fandom-requests": [{ id: "request-1", name: "Example fandom request", detail: "Sample request awaiting a catalogue identity check.", status: "pending" }],
    audit: [],
  };
}
function read(): Preview {
  try { const v = JSON.parse(localStorage.getItem(key) || "null"); if (v && Object.keys(initial()).every(k => Array.isArray(v[k]) && v[k].every((r: Entry) => r && [r.id,r.name,r.detail,r.status].every(s => typeof s === "string")))) return v; } catch { /* Start with samples when storage is unavailable or invalid. */ }
  return initial();
}
export function AdminPreview() {
  const section = location.pathname.split("/")[2] || "overview";
  const [data, setData] = useState(read), [query, setQuery] = useState(""), [notice, setNotice] = useState("");
  function change(group: keyof Preview, id: string, status: string) {
    const next = { ...data, [group]: data[group].map(r => r.id === id ? { ...r, status } : r), audit: [{ id: crypto.randomUUID(), name: `${group}: ${status}`, detail: `${id} · ${new Date().toLocaleString()}`, status: "preview" }, ...data.audit] };
    setData(next);
    try { localStorage.setItem(key, JSON.stringify(next)); setNotice("Preview change saved in this browser."); } catch { setNotice("Preview updated for this visit. Browser storage is unavailable."); }
  }
  const group = section as keyof Preview;
  const rows = (data[group] || []).filter(r => `${r.name} ${r.detail} ${r.status}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="live-area">
    <div className="live-title"><h1>Administration</h1><span className="live-badge">Development preview</span></div>
    <p className="notice">Explore the admin area without signing in. These are sample records; changes stay in this browser. Live database administration is separate.</p>
    <AdminNavigation role="admin" section={section} />
    {notice && <p role="status" className="notice">{notice}</p>}
    {section === "overview" ? <>
      <div className="admin-metrics">{[["Sample accounts", data.users.length], ["Sample posts", data.posts.length], ["Open sample reports", data.reports.filter(r => r.status === "open").length], ["Preview fandoms", data.fandoms.filter(r => r.status === "active").length]].map(([label,value]) => <section key={label}><strong>{value}</strong><span>{label}</span></section>)}</div>
      <div className="admin-guide"><h2>Community control centre</h2><p>Try reviewing reports, hiding posts, suspending sample accounts and archiving fandoms. Each change appears in the preview audit log.</p><a className="primary" href="/admin/reports">Review sample reports</a><h3>Fandom catalogue</h3><p>Search real catalogue identities and save your setup list in the Catalogue. This preview queue demonstrates the review workflow.</p><a className="secondary" href="/catalogue">Open catalogue</a><h3>Live administration</h3><p>When accounts are configured, an authenticated staff session opens the live administration tools at these same URLs.</p><a className="secondary" href="/account">Account settings</a></div>
    </> : <>
      <label className="admin-filter">Search this preview<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, content or status" /></label>
      <div className="admin-list">{rows.map(row => <article className="admin-row" key={row.id}>
        <div className="admin-row-title"><strong>{row.name}</strong><span className="role-badge">{row.status}</span></div><p>{row.detail}</p>
        <div className="admin-row-actions">
          {section === "reports" && row.status === "open" && <><button className="secondary" onClick={() => change(group,row.id,"resolved")}>Resolve</button><button className="secondary" onClick={() => change(group,row.id,"dismissed")}>Dismiss</button></>}
          {section === "posts" && <button className="secondary" onClick={() => change(group,row.id,row.status === "hidden" ? "published" : "hidden")}>{row.status === "hidden" ? "Restore post" : "Hide post"}</button>}
          {section === "users" && <button className="secondary" onClick={() => change(group,row.id,row.status === "suspended" ? "active" : "suspended")}>{row.status === "suspended" ? "Restore account" : "Suspend account"}</button>}
          {section === "fandoms" && <button className="secondary" onClick={() => change(group,row.id,row.status === "archived" ? "active" : "archived")}>{row.status === "archived" ? "Restore fandom" : "Archive fandom"}</button>}
          {section === "fandom-requests" && row.status === "pending" && <><button className="secondary" onClick={() => change(group,row.id,"approved")}>Approve sample</button><button className="secondary" onClick={() => change(group,row.id,"rejected")}>Reject sample</button></>}
        </div>
      </article>)}</div>
      {rows.length === 0 && <div className="empty-state"><h2>No preview records</h2><p>{section === "audit" ? "Try an admin action to add a preview audit entry." : "Try a different search."}</p></div>}
    </>}
  </section>;
}
