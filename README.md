# Fanverse

A website-first multi-fandom social platform for music, TV and film communities. Fanverse is the internal project/repository name only. Public branding is undecided; the interface uses “Your fandoms” as a descriptive placeholder.

## Current implementation

React + TypeScript + Vite frontend using the approved Design 1 direction: white surfaces, soft lilac and violet accents. Responsive desktop, tablet and mobile layouts. The compact feed follows the supplied reference while retaining white surfaces and lilac/violet accents. Trending, illustrative listening-party cards and suggested fandoms occupy the right rail; mobile includes quick fandom filters.

The interactive preview includes:

- Text and photo posts, photo descriptions, editable/deletable own posts, spoiler warnings.
- Custom polls (2–4 distinct options), voting and local results.
- Replies and reply deletion, likes, bookmarks, reposts on your profile.
- Follow/unfollow accounts, mute/block and restoring hidden accounts in Profile preferences.
- Display name, bio and avatar editing.
- Fandom membership, feed filters, search and dedicated fandom feeds.
- Browser-local saving for posts, memberships, profile and activity, with an explicit storage failure warning.

This is still a **local preview**, not a shared social service. It has no sign-in, shared database, real follower counts, live listening rooms or private messaging. Reports are stored locally and are explicitly not sent to a moderator. Browser data does not follow users across devices. Images are limited to 750 KB and avatars to 250 KB while stored in localStorage; storage quota failures are shown to the user. Clearing browser site data deletes local activity.

Sample people, posts, counts and events remain labelled. Demo polls combine sample votes with the visitor's local choice; custom polls reflect local votes only. The concert moodboard uses a stock crowd photograph from Unsplash, not a photo of a named artist or claimed event. Artist portraits remain placeholders. Photo source: https://images.unsplash.com/photo-1459749411175-04bf5292ceea .

## URLs and navigation

Navigation uses real anchor links plus browser History API navigation. Each section can be opened in a new tab and refreshed directly:

- `/`, `/?feed=following`, `/?feed=fandoms`
- `/explore`, `/explore?q=search`
- `/fandoms`, `/fandoms/taylor-swift`, `/fandoms/sabrina-carpenter`, `/fandoms/olivia-rodrigo`, `/fandoms/tv-and-film`
- `/notifications`, `/messages`, `/bookmarks`, `/profile`

Back/Forward updates the displayed page. Unknown paths display a not-found view. The Cloudflare static asset configuration falls back to index.html for SPA routes, so refreshing a deep link preserves the requested page. There is no server authorization in this frontend preview; backend authorization is required before shared accounts/content are added.

## Feed behaviour being evaluated

Home currently mixes joined fandoms, Following filters followed demo accounts, and My fandoms filters posts to joined communities. Individual fandom pages show that community's posts. Joining a fandom does not follow its members. For you combines joined fandoms and followed accounts, Following uses followed accounts, and My fandoms uses joined communities. Muted and blocked accounts are excluded from rendered feeds, search and bookmarks. Backend policies are not finalized.

## Local development

Install Node.js 22 or newer. From the project directory:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. From Windows PowerShell, the same commands work.

```sh
npm run typecheck
npm run build
npm run preview
```

## Cloudflare Workers setup

This repo includes a static-assets-only Worker configuration in `wrangler.jsonc`. No Cloudflare database, backend or paid service is provisioned by this configuration.

For Git integration:

- Project name: `fanverse`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Preview command: `npx wrangler versions upload`
- Root directory: repository root
- Cloudflare Access: off for a publicly accessible site

Cloudflare installs dependencies before building. Deploy only when ready to publish. The frontend does not require secrets or environment variables.

## Next development stages

Choose backend/database/authentication with explicit cost review; implement persistent accounts, posts and community memberships; add authorization, moderation, blocking, reporting and spam controls before accepting public user content. Do not imply fan communities are official artist accounts.

See AGENTS.md for development guidelines.

## Verification of the core feature batch

Production build passed. Browser checks against the production preview covered direct section URLs and refresh, Back/Forward, fandom deep links, unknown paths, Following URL persistence, image posts across refresh, saved replies/likes/bookmarks, custom poll voting, profile editing, following/blocking, edit/delete cleanup, and the mobile composer. Viewports at 320, 390, 768, 1024 and 1440 pixels were checked for horizontal overflow. These checks do not validate backend behaviour because the backend is not implemented.
