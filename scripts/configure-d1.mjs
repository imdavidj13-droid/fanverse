import { readFileSync, writeFileSync } from "node:fs";
const id = process.argv[2];
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id || "",
  )
)
  throw new Error("Pass the UUID of the dedicated fanverse-db database.");
const path = new URL("../wrangler.jsonc", import.meta.url),
  config = JSON.parse(readFileSync(path, "utf8"));
config.d1_databases = [
  {
    binding: "DB",
    database_name: "fanverse-db",
    database_id: id,
    migrations_dir: "migrations",
  },
];
writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
console.log(
  "Dedicated fanverse-db binding configured. No migrations or deployment performed.",
);
