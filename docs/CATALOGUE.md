# Canonical fandom catalogue

Each fandom represents one canonical Wikidata subject. Artists, TV series and films are supported; albums, perfumes, discographies and related products are excluded from joinable artist results. Exact primary titles rank before aliases and broader matches. Separate legitimate works with the same title remain distinct.

Search resolves candidates through Wikidata entity claims rather than trusting the search result text. Server-controlled classification uses bounded class/occupation ancestry. Requests use caching, coalescing, timeouts, meaningful identification and throttling. Uncertain subjects require review instead of being automatically published.

Joining uses `/api/fandoms/activate`, re-fetches source metadata server-side, respects recorded review/rejection decisions and enforces uniqueness by source ID. Activation and membership require a signed-in account. There is no browser-local setup list or offline creation path.

Taylor Swift, Sabrina Carpenter and Olivia Rodrigo retain their existing database identities and canonical source IDs. TV & Film is a general discussion hub. Communities have readable canonical URLs; identity is based on the subject ID rather than mutable titles.

Administrators manage `/admin/fandoms` and `/admin/fandom-requests`. Archives hide community content without freeing its identity for re-creation. Merges preserve posts, memberships, aliases, redirects, listening parties and community events. Source classification never overrides a staff rejection automatically. All write permissions are enforced in the Worker and moderation actions are audited.

Apply the complete migration set with `npx wrangler d1 migrations apply fanverse-db --remote`. Canonical identity tables originated in `0003_catalogue.sql`; cloud community events are added in `0006_cloud_site.sql`.

`npm test` verifies filtering, disambiguation, duplicate prevention, simultaneous activation, review decisions, archives, merges, preservation of existing records and block/moderation visibility against disposable databases.
