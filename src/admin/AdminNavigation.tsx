export function AdminNavigation({
  role,
  section,
}: {
  role: string;
  section: string;
}) {
  return (
    <nav className="admin-tabs" aria-label="Administration sections">
      {[
        ["overview", "Overview"],
        ["reports", "Reports"],
        ["users", "Users"],
        ["posts", "Posts"],
        ["fandoms", "Fandoms"],
        ["fandom-requests", "Fandom requests"],
        ...(role === "admin" ? [["audit", "Audit"]] : []),
      ].map(([id, label]) => (
        <a
          key={id}
          className={section === id ? "selected" : ""}
          aria-current={section === id ? "page" : undefined}
          href={id === "overview" ? "/admin" : "/admin/" + id}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
