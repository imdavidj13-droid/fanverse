# Development guidelines

## Scope and product decisions

- Build a website-first multi-fandom social platform with responsive mobile and desktop interfaces.
- Read README.md before making product decisions. Clearly distinguish proposals from agreed requirements.
- Do not assume that a mockup, suggested feed behaviour or provider has been selected.
- Keep the experience focused on fans and communities; use familiar social interactions and accessible navigation.

## Implementation

- Keep code modular, accessible and straightforward to maintain.
- Label demo data and simulated interactions clearly. Do not describe local-only persistence as a shared service.
- Do not include secrets, API tokens, credentials or local environment files in commits.
- Once the scaffold exists, document exact setup, run and verification commands in README.md.
- Run checks appropriate to the change and report limitations accurately.
- Implement and verify authorization for server-side actions when account and community features are added.
- Respect blocking and moderation in feeds, replies, notifications and messaging.
- Use cursor pagination for growing feeds rather than loading every post at once.
- Do not introduce paid services or deploy publicly without authorization.

## Media and community content

- Do not present fan accounts or communities as official artist accounts.
- Treat generated mockup photography, dates and engagement counts as illustrative.
- Plan reporting, blocking, moderation and spam controls before accepting public content.
