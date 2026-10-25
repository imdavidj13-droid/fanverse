import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const email = process.argv[2],
  scope = process.argv[3];
if (
  !email ||
  email.length > 254 ||
  !/^\S+@\S+\.\S+$/.test(email) ||
  !["--local", "--remote"].includes(scope)
)
  throw new Error(
    "Usage: node scripts/bootstrap-admin.mjs your-email@example.com --local|--remote",
  );
const escaped = email.toLowerCase().replaceAll("'", "''"),
  directory = mkdtempSync(join(tmpdir(), "community-admin-")),
  file = join(directory, "bootstrap.sql");
// One-time owner bootstrap only. It cannot grant additional admins after one exists.
// The owner bootstrap records its intent before granting access.
const sql = `INSERT INTO audit_log(actor_id,action,target_type,target_id,reason)
 SELECT p.user_id,'admin.bootstrap','user',p.user_id,'Initial administrator granted by the owner CLI'
 FROM profiles p JOIN user u ON u.id=p.user_id WHERE lower(u.email)='${escaped}' AND p.status='active' AND (u.emailVerified=1 OR ${scope === "--local" ? 1 : 0}=1)
 AND NOT EXISTS(SELECT 1 FROM profiles WHERE role='admin');
 UPDATE profiles SET role='admin' WHERE user_id IN(SELECT target_id FROM audit_log WHERE action='admin.bootstrap') AND user_id=(SELECT id FROM user WHERE lower(email)='${escaped}');
 SELECT username,role FROM profiles WHERE user_id=(SELECT id FROM user WHERE lower(email)='${escaped}');`;
writeFileSync(file, sql, { mode: 0o600 });
try {
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "--config",
      scope === "--local" ? "wrangler.local.jsonc" : "wrangler.jsonc",
      "d1",
      "execute",
      "fanverse-db",
      scope,
      "--file",
      file,
    ],
    { stdio: "inherit", shell: false },
  );
  if (result.status !== 0) process.exitCode = 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
