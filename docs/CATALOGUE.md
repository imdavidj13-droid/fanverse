# Catalogue and canonical fandoms

## Available without D1

`/catalogue` searches Wikidata through read-only Worker endpoints. The catalogue endpoints run before the account/database configuration gate, so public lookup does not require a D1 binding, account or provider API key.

- Search is submitted explicitly, not on every keystroke.
- Up to eight source matches are hydrated together with bounded type/occupation ancestry checks.
- English or multilingual labels, English descriptions, aliases, source revision and Wikidata IDs are used. No Wikipedia article text or third-party images are imported.
- Source results keep their IDs and types. A similarly named album is not assumed to be its artist or a TV series.
- Supported music performers/groups, TV series and films can be activated after accounts/D1 are connected. Album classifications are excluded as standalone fandoms. Uncertain records need administrator review.
- The preview can save up to 30 chosen source records to a browser-local setup list. That list is not a public community directory and does not grant membership. Photos, posts and accounts are not created when saving it.
- Source errors are displayed. Starter search shortcuts are labelled and are not substituted for successful live search results.

`GET /api/catalogue/search?q=...` and `GET /api/catalogue/subjects/Q...` are read-only. Their upstream host is fixed to Wikidata: a visitor cannot provide an arbitrary fetch URL.

The User-Agent identifies this project. Search responses are cached for 15 minutes and entity responses for 24 hours in the Worker Cache API. Upstream work is serialised and identical in-flight lookups coalesce within each isolate. The pending queue is bounded. Public catalogue requests also have a best-effort, per-isolate IP limit; this is not a global distributed rate-limit guarantee. Retry-After information is surfaced for upstream congestion without a busy retry loop. Higher-volume deployments need an appropriate Wikimedia access arrangement and/or indexing strategy, rather than treating the public API as unlimited infrastructure.

## Activation after connection

Migration `0003_catalogue.sql` introduces the canonical directory and removes the original four-fandom storage restriction while preserving existing post IDs, replies, likes, bookmarks, reports and memberships. Apply all committed migrations to the dedicated project database before enabling shared accounts. `/api/status` requires schema version 2 or later.

Each fandom has:

- Its own stable internal ID.
- A unique primary Wikidata ID and unique slug.
- Source-ID mappings for redirects/merged records.
- Aliases, subject type and source revision.
- Active, archived or merged status.

The initial Taylor Swift, Sabrina Carpenter and Olivia Rodrigo communities map to their existing preview IDs and the correct Wikidata IDs. TV & Film remains a deliberately generic discussion hub without claiming to represent one catalogue subject.

`POST /api/fandoms/activate` accepts a catalogue ID. It re-fetches source metadata on the server; caller-supplied titles, slugs and type overrides are ignored. Recognised subjects are created by the platform, with unique database constraints preventing concurrent duplicate creation. Existing subjects return the same community. Client aliases never become competing fan clubs. Starting and joining are separate idempotent requests in the interface.

An uncertain source record is queued rather than published. Rejected subjects stay declined until staff intervention; a later automated classification cannot bypass a recorded rejection. The browser-local setup list can be reopened after connection and activated item by item. Browser storage is not trusted as authoritative metadata.

Public routes use a readable ASCII slug plus the source ID, so non-Latin names still get working canonical URLs. The display name retains its original characters. `/fandoms/example-title-q123` opens a metadata preview without D1, or the shared fandom when connected. Shared post forms and feed filters load the canonical directory rather than relying solely on the four original examples.

## Administration

- `/admin/fandoms`: directory search and archive/restore controls.
- `/admin/fandom-requests`: the pending source-review queue.
- Moderators can read these queues. Directory changes require an administrator and a reason.
- Staff approval re-checks the source record and requires a verified subject type for unclear entries.
- Archives retain the identity, prevent duplicate recreation and remove that fandom's posts from public feeds.
- Merges require two different, compatible subject fandoms. They transfer posts, memberships, aliases, request links and source IDs, preserve old links through redirects, and record an audit entry. Generic category hubs cannot be merged into individual subjects through this control.

There is no public free-form community-creation endpoint. Name-only records that are absent from Wikidata, manual metadata refresh, per-fandom moderator assignment and wider language/discovery tooling remain future additions. Do not describe the current catalogue as exhaustive or its type checks as infallible.

## Verification

The integration suite covers no-D1 lookup, caching, source disambiguation, name-override rejection, concurrency, uncertain/rejected records, permissions, dynamic posts/memberships, archives, merges and preservation of old data during migration. Tests use an injected source service with clearly synthetic records; the production configuration does not include that test binding.

Browser checks cover both no-D1 staging and connected local activation, including posting into the newly chosen fandom, canonical URLs, staff review, archive controls and five viewport widths. A real Wikidata lookup for Sabrina Carpenter also passed through the provider using an HTTPS bridge. The sandbox's direct Worker DNS could not reach the external host; direct outbound connectivity from the deployed Cloudflare Worker still needs checking after deployment.

## Sources

- https://www.wikidata.org/wiki/Wikidata:Data_access
- https://www.wikidata.org/w/api.php?action=help&modules=wbsearchentities
- https://www.mediawiki.org/wiki/API:Etiquette
- https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits

Structured Wikidata metadata is CC0. Images and other linked material have separate rights and are intentionally not imported by this feature.
