# Connect the dedicated Cloudflare backend

All commands are run from the repository root with Node.js 22 or newer. The existing local preview remains available until backend configuration is complete. No existing WSL Stats database is used.

## Local development

```sh
npm ci
npm run build
```

Copy `.dev.vars.example` to `.dev.vars`, and generate a fresh local secret. The file is ignored by git. Use the explicit local configuration:

```sh
npx wrangler d1 migrations apply fanverse-db --local --config wrangler.local.jsonc
npx wrangler dev --config wrangler.local.jsonc
```

Open the address printed by Wrangler (normally http://localhost:8787). Local development mode skips email verification only for a localhost base URL and matching localhost requests. It never enables verification-free signups on a public Worker URL.

After creating a local account and opening `/account` once, bootstrap a local administrator:

```sh
node scripts/bootstrap-admin.mjs your-local-email@example.com --local
```

Then sign in and open `/admin`.

## Production database

Create a **new** database named `fanverse-db`, through Cloudflare D1 or this command:

```sh
npx wrangler d1 create fanverse-db
```

Use the returned database UUID (not an API token):

```sh
node scripts/configure-d1.mjs DATABASE-UUID
```

Review and commit the generated `wrangler.jsonc` binding. The script only updates configuration; it does not run migrations or deploy. The binding name must be `DB`.

Apply the committed migrations once to the dedicated database:

```sh
npx wrangler d1 migrations apply fanverse-db --remote
```

Future migrations also need applying before deploying code that depends on them. Migration files are additive, versioned and tracked by Wrangler. Never point this project at an unrelated database.

## Production account settings

Set `BETTER_AUTH_URL` to the exact HTTPS origin used to access the account service, for example the project's workers.dev URL. Set the following Worker secrets through the Cloudflare dashboard or `npx wrangler secret put NAME`:

- `BETTER_AUTH_SECRET`: a randomly generated secret of at least 32 characters.
- `RESEND_API_KEY`: key for account-email delivery.
- `EMAIL_FROM`: a sender address from a verified sending domain, with an optional display name.

`BETTER_AUTH_URL` can be a normal Worker variable. Do not set `AUTH_DEV_MODE` in production. Do not paste secrets into chat or commit them to the repository. Email delivery needs a configured provider and verified sending domain; this repository does not purchase or provision either, and does not promise a particular provider plan is free.

The sender currently integrates with Resend's email API. Production registration requires email verification; verification resends and password-reset forms are included. The email integration has not been exercised against a production sender in this work session.

Deploy with the existing Cloudflare Git build command `npm run build` and deploy command `npx wrangler deploy`. After changing secrets/variables in Cloudflare, ensure the deployed Worker version has those settings.

Visit `/api/status`: it should return `{"ready":true,"mode":"shared"}`. If configuration, database migration or origin matching is incomplete, the shared account screen remains in setup mode. This is intentional; it does not pretend browser-only data has become shared.

Create and verify your own account, then open `/account` to initialize its community profile. Grant the first production administrator through your authenticated owner CLI:

```sh
node scripts/bootstrap-admin.mjs your-verified-email@example.com --remote
```

Inspect the returned role, then sign in and open `/admin`. The bootstrap script records the owner operation and grants only the first administrator; additional staff are managed from the authenticated admin area. Keep owner-level Cloudflare access for administrator recovery.

## Verification

```sh
npm test
```

This builds the frontend and Worker and runs integration tests against a disposable local D1 instance using Miniflare. No production database is contacted. Test-only secrets and development settings are confined to local fixtures.

## Catalogue activation

The migration set now includes `0003_catalogue.sql`, which upgrades the application schema to version 2 and replaces the initial four-fandom restriction with a canonical directory. Apply all pending migrations with the documented Wrangler command before testing shared accounts.

You can search `/catalogue` and stage records before configuring any database. After connection and sign-in, revisit those records to activate and join their fandoms. Review and directory controls are at `/admin/fandom-requests` and `/admin/fandoms`. No Wikidata API key is needed for the read-only integration. Do not add the fixture-only `CATALOGUE_SOURCE` service binding to production.
