# Fanverse

A website-first multi-fandom social platform for music, TV and film communities. Fanverse is the internal project/repository name only. Public branding is undecided; the interface uses “Your fandoms” as a descriptive placeholder.

## Current implementation

React + TypeScript + Vite frontend using the approved Design 1 direction: white surfaces, soft lilac and violet accents. Responsive desktop, tablet and mobile layouts. The compact feed follows the supplied reference while retaining white surfaces and lilac/violet accents. Trending, illustrative listening-party cards and suggested fandoms occupy the right rail; mobile includes quick fandom filters.

The interactive preview includes feed tabs, fandom pages, join/leave controls, text posting, likes, bookmarks, local replies, repost toggles, illustrative polls, search, a demo profile, and a mobile post composer. Notifications and messages clearly explain that their backend is not connected. The concert moodboard uses a stock crowd photograph from Unsplash, not a photo of a named artist or claimed event. Artist portraits remain placeholders. Photo source: https://images.unsplash.com/photo-1459749411175-04bf5292ceea .

All posts, people, counts and poll percentages are illustrative. Interactions are held in memory and reset on refresh. No authentication, uploads, database, private messaging or shared persistence exists yet.

## Feed behaviour being evaluated

Home currently mixes joined fandoms, Following filters followed demo accounts, and My fandoms filters posts to joined communities. Individual fandom pages show that community's posts. Joining a fandom does not follow its members. These preview behaviours remain open to refinement; backend policies are not finalized.

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
