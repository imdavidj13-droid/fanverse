# Administration scope

The administration area is a first operational foundation, not a claim to reproduce every internal X/Twitter tool. Its data comes from the shared database, not the local preview.

## Implemented

- `/admin`: account, published-post, open-report and suspension counts.
- `/admin/reports`: open/resolved/dismissed queues, reported post and reporter context, review notes, resolving and dismissing reports.
- `/admin/posts`: published/hidden/deleted post visibility; hide/restore controls for eligible content. Hiding a post is distinct from resolving a report.
- `/admin/users`: username/display-name search, suspension/restoration, moderator promotion/removal, administrator promotion. Suspension and role changes invalidate the target's active sessions.
- `/admin/audit`: actor, action, target, reason and timestamp. Administrator-only.
- Reason-required moderation actions, recorded in the same D1 batch as the mutation.
- Roles checked on the server for every administration request. A browser role flag never grants access.
- Cursor pagination. Search does not expose account emails.
- Member posts can be moderated by moderators; staff posts require an administrator.
- Staff accounts must be demoted before suspension. Self access changes and administrator demotion are prohibited through the web controls to prevent losing all administrators.
- A one-time owner CLI creates the first administrator only after an account exists. It cannot grant arbitrary new administrators once one exists. Production bootstrap requires verified email.

## Permissions

| Action                                 | Member | Moderator | Administrator |
| -------------------------------------- | ------ | --------- | ------------- |
| Read public content / manage own posts | Yes    | Yes       | Yes           |
| Submit a report / block an account     | Yes    | Yes       | Yes           |
| Read moderation queues                 | No     | Yes       | Yes           |
| Hide or restore member posts           | No     | Yes       | Yes           |
| Moderate staff posts                   | No     | No        | Yes           |
| Suspend/restore member accounts        | No     | No        | Yes           |
| Assign staff roles                     | No     | No        | Yes           |
| Read audit log                         | No     | No        | Yes           |

## Next stages

1. **Fandom management:** descriptions, artwork, community rules, posting permissions, moderator assignments, redirects for renamed communities.
2. **Expanded moderation:** reply reports/moderation, user history, contextual conversations, internal staff notes, warnings, temporary restrictions and scheduled expiry.
3. **Appeals:** user notifications of decisions, appeal submissions, assignment and independent review.
4. **Spam and abuse:** configurable rate limits, signup challenges, suspicious link review, repeat-offender patterns and queues. Initial endpoint/account limits already exist; automated detection does not.
5. **Media:** R2 upload policies, file validation, storage usage, moderation queue and removals. Shared media uploads are intentionally not enabled yet.
6. **Platform settings:** registration rules, maintenance mode, feature flags, community announcements and email templates.
7. **Staff operations:** granular permissions, reviewer assignments, audit filtering, reason templates and emergency access recovery.
8. **Operational visibility:** API errors, email delivery failures, jobs/queues, database usage and service health. Only live database counts exist today.
9. **User data operations:** account deletion, export, retention policy and recovery workflows. These need deliberate product decisions before implementation.

Private messages, live listening rooms, algorithm tuning and advertising tools are not implemented. Do not add administration pages that suggest those systems exist before their underlying features do.

## Catalogue administration added

The canonical directory now has `/admin/fandoms` and `/admin/fandom-requests`. Administrators can review unclear source subjects, archive/restore directory entries and merge genuine duplicate records while preserving posts, memberships, aliases and old routes. Moderators have read access. This foundation waits for the D1 connection; the public catalogue search and local setup list work independently. See [CATALOGUE.md](CATALOGUE.md) for the exact boundaries and migration.
