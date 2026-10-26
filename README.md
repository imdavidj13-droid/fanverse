# Fanverse (internal project name)

A website-first multi-fandom social platform for music, TV and film communities. Public branding is undecided; the interface currently says **Your fandoms**.

React + TypeScript + Vite, using the approved white/lilac/violet Design 1 direction, with responsive desktop, tablet and mobile layouts. The Worker backend now supports the selected **Cloudflare D1** database. WSL Stats resources are not used.

## Current state

There are two deliberately separate experiences while the shared platform is being connected:

- **Local preview:** the existing Home, Explore, My fandoms, Profile and Bookmarks interfaces. Posts, photos, polls, spoiler warnings, profile edits, follows, blocks and activity are saved in the current browser. They do not become public automatically.
- **Shared backend:** `/account`, `/community` and `/admin`. These use server sessions, normalized D1 tables and authorization. They display a setup message until the dedicated database, account secret, public origin and account-email delivery are configured.

No production database, email account or paid service was provisioned in this implementation session. Backend behaviour was tested against disposable local D1 instances. Production account-email delivery still needs connecting and verification.

## Shared features implemented

- Better Auth registration, email verification/resend, sign-in/sign-out and password-reset integration; production requires verified email.
- Shared profiles with unique usernames, display names and bios.
- Cursor-paginated text posts and fandom filters, latest/following/membership/bookmark feeds, own-post edit/delete API.
- Replies, likes, bookmarks, fandom memberships and follow/unfollow APIs.
- Bidirectional blocks that exclude content server-side, remove follows and prevent replies to inaccessible posts.
- Reports submitted to the actual moderation queue.
- Account write limits and database-backed authentication rate limits.
- Owner checks for post/reply mutations, same-origin checks for writes, bounded JSON input, parameterized SQL and no public account-email output.

Shared photos, avatars, polls, reposts, notifications, private messages and live listening rooms are **not** connected yet. Those controls in the original preview remain local-only. The shared feed currently supports text posting, reading, replies, likes, saving, reporting, blocking and following. The backend additionally supports own-post editing; a shared edit UI remains to be added.

## Administration

The first operational administration area includes:

- `/admin`: live database counts.
- `/admin/reports`: open/reviewed queues, report context, resolution/dismissal with notes.
- `/admin/posts`: hiding/restoring eligible posts.
- `/admin/users`: account search, suspension/restoration and staff-role assignment.
- `/admin/audit`: administrator-only records of staff actions.

Roles are enforced by the server, not a local browser flag. Moderators cannot manage user access or moderate staff posts. Administrators cannot remove their own access, suspend staff without demotion, or demote another administrator through the web controls. Suspension and role changes revoke the affected user's sessions.

See [the administration scope and roadmap](docs/ADMIN.md) for permissions and the next stages: fandom management, reply moderation, appeals, media review, spam tooling, platform settings and operational visibility.

## Development

Install Node.js 22 or newer:

```sh
npm ci
npm run dev
```

Vite provides the local design preview. For connected account/backend development, follow [the D1 and account setup instructions](docs/CONNECTING.md), using the explicit local Worker configuration.

```sh
npm run typecheck
npm run build
npm run preview
npm test
```

`npm test` bundles the Worker and exercises authentication and administration against disposable local D1 databases; it does not contact production.

## URLs

Navigation uses actual links and browser history, supports new tabs and survives refresh:

- `/`, `/?feed=following`, `/?feed=fandoms`
- `/explore`, `/explore?q=search`
- `/fandoms`, `/fandoms/taylor-swift`, `/fandoms/sabrina-carpenter`, `/fandoms/olivia-rodrigo`, `/fandoms/tv-and-film`
- `/notifications`, `/messages`, `/bookmarks`, `/profile` (local preview)
- `/account`, `/community`, `/community?feed=following&fandom=taylor`
- `/admin`, `/admin/reports`, `/admin/users`, `/admin/posts`, `/admin/audit`

Unknown routes show a not-found screen. Cloudflare serves the SPA entry for application routes and sends `/api/*` to the Worker first.

## Deployment and activation

Cloudflare Git integration remains:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Preview command: `npx wrangler versions upload`
- Root directory: repository root

The committed production configuration intentionally contains no invented D1 ID. Create a new `fanverse-db`, configure its `DB` binding and apply the committed migrations before activating accounts. [Exact commands and settings are documented here](docs/CONNECTING.md). Production also needs the exact HTTPS account-service origin, a random secret and verified account-email delivery. Do not put secrets in the repository or chat.

Cloudflare Git deployment does not automatically apply D1 migrations; follow the documented migration step before deploying database-dependent updates. Keep production and preview/test data separate.

## Verification

The backend integration suite covers hashed credentials and D1 sessions, admin access denial, attempted browser role escalation, cross-origin write rejection, ownership, idempotent reactions, shared replies, moderation and audit records, staff boundaries, suspension/session revocation, bidirectional blocks, cursor pagination, rate limits, unconfigured service behaviour, origin matching, admin search and membership feeds.

Browser checks against the built frontend and local Worker covered actual sign-in, desktop/mobile administration, report hiding/resolution, suspension, audit entries, member access denial, shared posting across refresh, filter URLs and responsive widths of 320, 390, 768, 1024 and 1440 pixels.

## Media and sample content

Artist imagery remains placeholder artwork. Sample counts, people and events are labelled. The concert moodboard is a stock crowd photo, not a named artist/event photo. Source: https://images.unsplash.com/photo-1459749411175-04bf5292ceea .

See AGENTS.md for development guidelines.

## Customisable profiles and database-free additions

Open **Profile → Customise your profile**, or `/profile/edit`, for the local profile studio:

- Six starter themes, five colour controls and three font families.
- Gradient covers, optional cover photos (under 250 KB), dot/star patterns and adjustable corner rounding.
- Classic and centred spotlight layouts.
- Tagline, favourite song/album, quote, fandom badges, optional statistics and an own-post pin.
- A live preview and a Theme CSS editor. Supported variables are validated and applied only to the profile card. Arbitrary selectors, scripts, imports, URLs and unsupported properties are rejected. The site itself retains its white theme.

Theme settings are saved in the existing browser-local preview state, with defaults merged for older saved profiles. They are not uploaded to shared accounts yet.

Other additions:

- `/posts/:id` opens a local conversation directly, including replies. Personal preview links only work where the post exists; copying a link does not upload it.
- `/fans/:handle` opens a sample fan profile; profile names in posts are links.
- Explore has Posts, People, Fandoms and Media categories, searchable through URLs such as `/explore?view=people&q=liv`.
- Photos open in a keyboard-accessible native dialog and close with Escape.
- Separate inline/fandom/modal composer drafts restore text, poll choices, fandom and spoiler settings across refresh. Photo files must be selected again; they are intentionally not duplicated in draft storage.
- `/settings` provides compact reading, larger post text, spoiler defaults, Home fandom visibility and muted words. Filters affect the local preview; display choices are stored on the current browser.
- `/notifications` now shows **your own local activity**, with unread counts, read controls and a preference to stop recording it. It does not simulate other people sending notifications, email or push delivery.

Browser verification covered draft isolation/recovery, post/profile URLs, replies, photo viewing, people search, theme persistence and CSS restrictions, profile layouts/details/pinning, Home visibility, muted words and local read status. Profile, editor, settings, media search and activity pages were checked at five viewport widths from 320 to 1440 pixels.

## Catalogue foundation

Open **Catalogue**, or `/catalogue`, to search for artists, TV series and films through Wikidata without connecting D1. You can inspect source identities and save records to a browser-local setup list. Saving a record does not create a public fandom.

The backend now includes canonical subject IDs, duplicate-safe activation, a review queue, archival and merge controls. These wait for the dedicated D1 connection. Migration `0003_catalogue.sql` preserves existing content while allowing fandoms beyond the initial four examples.

See [the catalogue design and verification notes](docs/CATALOGUE.md). The existing setup guide still applies: run all committed D1 migrations when creating the database. No production database was connected or written during this work.

## Administration development preview

Visitors without a staff session can explore `/admin` and its section URLs without email setup. The development preview uses explicitly labelled sample records and browser-local persistence. It never calls the admin APIs or reads or changes live database records. Sample moderation actions populate a local audit log. Authenticated accounts continue through the existing server-authorized administration flow; member accounts do not receive staff permissions. Public account registration still requires the documented email setup.

## Fandom community pages

Seed fandom URLs now use a reusable themed community layout with Discussions, Fan creations, Events and About sections encoded in the URL. Discussions support browser-local publishing in the selected fandom, search and latest/most-liked sorting. Fan creations filter visual posts. Event plans can be created and removed locally and persist per fandom. A contextual sidebar contains guidelines, verified-announcement empty states and related communities. Covers are original CSS artwork; no artist images, invented releases or live member counts are introduced. The same shell wraps connected catalogue fandoms, retaining their authorized shared discussion feed. Shared media remains explicitly unavailable. Event plans are browser-local even on connected pages.

Verify with `npm run build`; visit `/fandoms/taylor-swift`, switch tabs, refresh, publish a local post and create an event plan. Check narrow mobile and desktop layouts.

## Stationhead listening parties

Open `/parties`, or a fandom’s Events tab. Fans can plan a Stationhead listening party, RSVP, download a calendar event with a 10-minute reminder, and open the external room in a new tab. Parties have stable `/parties/:id` URLs. Live status requires the host to explicitly confirm it; playback and Stationhead account access are external. Local previews are saved only in the current browser and cannot be shared between devices. They are not imported into the shared database automatically.

The shared API requires accounts plus `0004_listening_parties.sql`. Apply it from the project root with `npx wrangler d1 migrations apply fanverse-db --remote`. This version does not run remote migrations automatically. Authenticated hosts create parties and control status; members RSVP and report; staff review reports at `/admin/party-reports`. Blocked/suspended hosts and archived fandoms are excluded, and fandom merges transfer party references. External URLs are restricted to HTTPS Stationhead room/share links. The application does not verify station ownership or broadcast state, host audio, create Stationhead accounts, or collect its credentials. Calendar exports suggest a one-hour slot.

## Signup entry screen

First visits to `/` show the standalone colourful signup screen. `/join` and `/login` have real URLs. The options are phone, Apple, Google and email, in that order. The development preview remains available through an explicit Explore button; this only opens browser-local preview features and does not grant server access. Existing authenticated sessions skip the root entry screen.

Email uses the existing verified-account flow and stays disabled until account/email configuration is ready. Google and Apple are conditionally connected through Better Auth when owner-provided credentials are present; they are not enabled in this deployment. Phone signup is a clearly marked future integration and does not collect phone numbers or simulate SMS codes. No live third-party sign-in was completed in this session. See `docs/CONNECTING.md` for provider settings.

## Home feed experience

Home uses a dedicated responsive feed component. For you uses joined fandoms and followed people; Following uses followed people; My fandoms uses joined fandoms. Own posts remain available in each feed. Discover is an explicit opt-in to wider preview conversations. All four respect blocked/muted users, muted words and fandoms hidden from Home. The sidebar’s conversation starters respect those same preferences.

Fandom, post-type (everything / photos and art / polls / text), feed search and sort (latest / most liked / most replies) are URL parameters and survive refresh and browser navigation. Fandom chips filter within the selected feed instead of bypassing its follow or safety rules. Local lists reveal 12 posts at a time. Existing photo, poll, spoiler, reply and moderation controls remain available. The original hardcoded listening-party sidebar has been removed in favour of the working Stationhead list. Sample engagement is still labelled, and the local Home preview remains separate from `/community` shared records.
