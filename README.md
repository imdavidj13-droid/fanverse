# Fanverse (internal name)

Website-first fandom social platform. Public branding is **Your fandoms**, with the approved white/lilac/violet direction and responsive desktop and mobile layouts.

React, TypeScript and Vite serve the interface; a Cloudflare Worker, Better Auth and the dedicated Cloudflare D1 database provide all account and community data. WSL Stats resources are never used.

## Cloud-only application

There is one account-backed site. There is no local-preview mode, sample feed, browser-only profile, sample administration or browser-storage persistence. Signed-out visitors see signup/sign-in; unavailable backend services show a connection error rather than simulated success. In-progress form inputs exist in memory until saved. The post composer saves drafts to the account after a short typing delay.

D1 stores:

- Accounts, sessions, verified provider identities, onboarding and private birth dates.
- Profiles, unique usernames, biographies, avatars, covers, theme CSS, favourite songs/albums, quotes and pins.
- Text/photo/spoiler/poll posts, replies, likes, reposts and votes.
- Bookmarks and private bookmark collections, including assignments.
- Fandom identities, memberships, follows, blocks, mutes, hidden home-feed fandoms and reading preferences.
- Private direct messages and read receipts, genuine like/reply/follow notifications and read state.
- Stationhead listening-party metadata and RSVPs, community events and RSVPs.
- Moderation reports, staff roles and audit records.

Images are compressed client-side and stored as bounded PNG/JPEG/WebP data in D1 (roughly 400 KB maximum per image). No external storage account is required for this implementation. Video upload is not offered. Music playback stays on Stationhead.

Old browser preview records are not imported into real public accounts. Empty accounts display genuine empty states, never sample engagement counts.

## Run and test

Use Node.js 22 or later:

```sh
npm ci
npm run typecheck
npm run build
npm test
```

`npm test` builds frontend assets, bundles the Worker and runs authentication, community, catalogue, onboarding and cloud feature tests against disposable Miniflare D1 databases. It does not modify production. The migration test helper preserves SQLite trigger bodies.

For a full connected development server, apply migrations to local D1 and run Wrangler with the explicit localhost configuration described in [CONNECTING.md](docs/CONNECTING.md). Vite alone does not provide a database or account API.

## Production

URL: https://fanverse.imdavidj13.workers.dev

Apply pending migrations from the latest checkout:

```powershell
cd C:\fanverse
git pull origin main
npx wrangler d1 migrations apply fanverse-db --remote
```

The cloud-only release requires `0006_cloud_site.sql`. Cloudflare Git integration builds with `npm run build` and deploys with `npx wrangler deploy`. D1 migrations are a separate operation; Git builds do not apply them. If the interface is deployed first, apply the pending migration and refresh.

`wrangler.jsonc` retains the actual D1 binding, tracks `BETTER_AUTH_URL`, and sets `keep_vars: true`. Store `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Cloudflare secrets. Do not commit secret values. Deployments preserve existing secrets and dashboard variables.

Google is the currently selected signup provider. Apple is deferred; phone sign-in is not configured. The interface only exposes connected optional providers and email delivery. OAuth return URLs remain `/api/auth/callback/google` and (when configured) `/api/auth/callback/apple`.

## Navigation

All navigation uses real links and history and survives refresh:

`/`, `/explore`, `/fandoms`, `/catalogue`, `/fandoms/:slug`, `/parties`, `/parties/:id`, `/notifications`, `/messages`, `/bookmarks`, `/profile`, `/profile/edit`, `/fans/:username`, `/posts/:id`, `/settings`, `/account`, `/community`, `/join`, `/login`, `/onboarding`.

Feed, search, collection and conversation choices use URL query parameters. `/community` reads the same database posts as Home; `/account` edits the same profile as `/profile`.

## Administration and privacy

`/admin`, `/admin/users`, `/admin/posts`, `/admin/reports`, `/admin/audit`, `/admin/fandoms`, `/admin/fandom-requests` and `/admin/party-reports` use actual staff permissions and database records. Members do not receive an administrative preview. Existing role promotion instructions remain in [CONNECTING.md](docs/CONNECTING.md).

All writes verify origin and identity; growing lists use cursors. Post changes enforce ownership. Blocks apply in both directions in feeds, replies, notifications, direct messages and events. Private messages are returned only to their sender and recipient; profile responses exclude birthdays, preferences, drafts and account email. Poll votes and RSVPs are unique per account. Profile edits use revision checks to prevent overwriting a newer edit on another device. Theme CSS is restricted to the supported profile variables.
