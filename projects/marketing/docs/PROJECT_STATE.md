# Project State

## 2026-10-27 database recovery and editorial migration applied

- The development Supabase project `valiantum-marketing-os-dev` (`dkjoqbsicfjbzwwqpfcc`, org `hladgrckmdmkcplfwnhe`, East US Ohio) had been **paused by free-tier inactivity**, not deleted. Its hostname stopped resolving, which initially looked like data loss. It was restored from the Supabase dashboard and came back fully intact.
- The 2026-10-06 note that this Mac's Supabase CLI had no active login was the wrong diagnosis. The CLI was authenticated, but to a **different Supabase account** holding only the PantryWise org, through a scope-limited token that returned an empty organization list and a 403 on this project. The owning account is the `mitchgotpaid@gmail.com` personal org. Logging in for PantryWise will evict this token again.
- Supabase CLI upgraded 2.84.2 to 2.122.0; this project's migration history was written by 2.118/2.119.
- Migration `20261006230000_briefing_editorial_handoff.sql` is **applied**. Local and remote migration histories match at 21 of 21, zero pending.
- Data survived the pause in full: Nati Sports with voice, pillars, audience and logo; four publishing destinations with Facebook Page and Instagram still connected from 2026-09-29; 30 audit rows; two content items; two approvals; one publication attempt; and the $15 monthly budget singleton. `autonomy = LEVEL_1_MANUAL`, `publishing_enabled = false`, and `global_auto_publish_enabled = false` all survived unchanged.
- Verified after the migration: both new functions exist with `EXECUTE` granted only to `authenticated` and PUBLIC revoked, the four new `content_items` columns exist, anonymous reads of `brands` return 401, and anonymous RPC does not resolve.
- **No successful daily briefing has ever been stored.** All three `DAILY_BRIEFING_GENERATION` runs on 2026-10-01 recorded `succeeded = false`, and the third consumed the full $0.45 conservative failure charge. `content_items` holds only two `SOCIAL_POST` rows. The capture-on-failure migration landed at 03:30, after the last attempt, so it has never captured anything.
- Consequence: the briefing-to-post handoff in PR #1 has no real input to test against. Its smoke test requires generating a fresh briefing, which costs roughly $0.45 on a path with a 0-for-3 record.
- `src/types/database.ts` was left as committed. It already describes the deployed schema exactly, including the new functions and columns; regenerating under CLI 2.122 differs only by a `graphql_public` block the application does not use and a PostgREST version string. Note that these types already contained the new functions before the migration was applied, so they were not generated from this deployed schema.
- The Supabase security advisor reports warnings only, no errors. All but one are the intended "authenticated may execute SECURITY DEFINER function" pattern this architecture is built on. The exception, `public.rls_auto_enable()`, is flagged as anon-executable but returns `event_trigger`, so it cannot be invoked as an ordinary RPC. It is a Supabase-provided RLS safety net with no migration in this repository, and is the one known piece of schema drift.
- Local validation after the migration: 66 unit tests, strict TypeScript, and ESLint pass. No OpenAI call or public social post was made during this work.

## 2026-10-06 recovery and editorial handoff

- The original checkout was found at `/Users/mitchgibson/Desktop/Desktop - Mitch’s Laptop/Projects/Valiantum-Marketing-OS` after the intended `/Users/mitchgibson/Projects/Valiantum-Marketing-OS` path disappeared. A clean clone was restored to the intended path, and the newer local briefing-capture files plus the ignored `.env.local` were recovered. The old folder remains untouched as a fallback.
- The recovered capture-on-quality-failure work is included in this checkout with migration `20261001033000_capture_failed_ai_briefings.sql`. Its development-database application was reported in the prior task; remote migration parity still needs to be rechecked from this checkout.
- A cost-free briefing-to-social handoff is implemented locally: each source-backed opportunity can create separate Facebook, Instagram, and manual-X review drafts; the source briefing and links are retained. Draft edits and rejected-content resubmission are audited, reset verification/media clearance, and cannot change approved content. Approved derived drafts have a manual-copy handoff; no public provider call has been added.
- Migration `20261006230000_briefing_editorial_handoff.sql` was not applied as of this entry, and the Supabase CLI was believed to have no active login. Both statements are superseded by the 2026-10-27 entry above: the migration is applied, and the login diagnosis was wrong.
- Local validation: 66 unit tests, strict TypeScript, ESLint, and production build pass. No OpenAI call or public social post was made during this work.

## Immediate next steps

1. Decide whether to spend roughly $0.45 generating a fresh Nati Sports briefing. No stored briefing exists, so nothing downstream can be exercised without one. The capture-on-failure path is now deployed, so a failed attempt is retained for inspection rather than lost.
2. With a briefing stored, smoke-test one briefing-to-post flow, then take PR #1 out of draft and merge.
3. Refine the briefing quality rubric against the successful ChatGPT scheduled brief using captured output, without unnecessary repeat API calls.
4. Build claim/source verification, media readiness, and an explicitly approved Facebook public-post gate. Keep global auto-publish OFF until repeated real-world validation. Instagram media publishing follows; X remains manual.

## Current Milestone

Milestone 1 — Foundation and safety (IN PROGRESS).

## Current Application State

First-run foundation connected to the shared development Supabase project. A responsive Next.js dashboard shell, environment-validated Supabase SSR boundary, login flow, validated server-only Brand CRUD, consolidated plain-language Brand Settings, private Brand-logo assets, Brand Facts, Constitution, Source Hierarchy, Media Policy management, a human Approval Queue foundation, deployed schema/RLS migrations, database-generated audit records, generated database types, and deterministic automatic-publication eligibility engine exist. Secure Meta OAuth and the first provider test path now exist, but it can create only an administrator-requested unpublished Facebook Page post from approved content. Public publishing remains disabled. Global auto-publish defaults OFF and new brands default to manual autonomy with publishing OFF.

## Completed

- Repository and shared project memory initialized.
- Primary navigation and responsive setup-state dashboard.
- Supabase server client, session proxy, login action, and environment validation.
- Initial schema for brands, facts, rules, source hierarchy, media policy, content, approvals, audit logs, AI usage, membership, and system safety state.
- Initial RLS policies and separate access, administration, editing, and review role helpers.
- Pure publication-eligibility engine with invariant-focused unit tests.
- Brand list/create/edit/delete UI backed by a server-only data layer and server-side validation.
- Destructive Brand deletion requires an exact-name confirmation and fails closed when related content exists.
- Brand mutations generate immutable audit rows through a database trigger.
- Brand Facts support explicit verification states and require HTTP(S) source URLs before a human can label a fact supported or verified.
- Brand Constitution rules use structured ALWAYS, NEVER, and REQUIRE_REVIEW types; mutations are administrator-only and audited.
- Source Hierarchy uses tiers 1–4; Tier 4 is deterministically discovery-only, and approved sources require HTTP(S) URLs.
- Media Policy includes an explicit tri-state real-person likeness rule that remains UNSET/fail-closed until human configuration.
- Explicit Data API grants match authenticated RLS operations; anonymous callers receive no application-table privileges.
- Development Supabase is linked, all committed migrations are applied, local/remote migration histories match, and the linked schema linter reports no errors.
- TypeScript database types are generated from the deployed schema.
- Authenticated owner flows have been exercised against development Supabase for Brand, Fact, Constitution Rule, Source, and Media Policy writes; unauthenticated Data API reads are denied.
- Brand deletion and cascading governance cleanup are live-tested, with deletion audit events preserving removed identifiers in immutable metadata rather than invalid foreign keys.
- Review-ready content is created through a narrow audited database function with fail-closed defaults: NEEDS_REVIEW, UNVERIFIED, MEDIUM risk, human approval required, and media policy unsatisfied.
- Direct authenticated writes to approval-sensitive content and approval rows are revoked; approve/reject decisions are role-checked, serialized, atomic, and audit-backed.
- Approval Queue, submission, review detail, evidence context, review checks, decision history, and responsive decision controls are implemented.
- The authenticated Nati Sports workflow has been exercised end to end: submit fail-closed content, review safety context, reject with required reasoning, preserve decision history, and clear the pending queue.
- The dashboard now reflects live Brand state instead of retaining first-run guidance after Brand creation.
- Brand onboarding now requires only a name and slug. Website, organization type, description, audience, coverage pillars, marketing goals, voice, and special instructions are optional Settings with explanatory guidance.
- A tested Agent-context builder omits blank optional settings rather than presenting them as instructions or inviting inference.
- The former manual Fact/rule/source onboarding page now redirects to Brand Settings and is no longer exposed in the user flow.
- Brand logo upload, replacement, and removal are available directly in Settings. Logos are shown in the Brands workspace and included in Agent context as short-lived signed asset URLs.
- Brand identity, optional Agent guidance, logo management, and deletion controls now appear directly on the Settings page instead of requiring a separate Brand-detail screen.
- An optional, expandable Brand Playbook captures strategy, offers, proof points, audience needs and objections, channels, formats, calls to action, vocabulary, content examples, visual direction, preferred sources, disclosures, and prohibited topics.
- Playbook data is stored as a constrained JSON object and compacted so blank fields do not enter Agent context.
- Brand Settings records the low-cost social strategy: Facebook Page and Instagram Professional publishing through one Meta connection, TikTok through a future review-required integration, and X through a credential-free manual handoff. Destination metadata is RLS-protected, audited, read-only through the authenticated Data API, backfilled for existing Brands, and deployed; provider secrets remain encrypted outside the public schema.
- Meta OAuth now validates state, discovers one authorized Page and linked Instagram professional account, encrypts the resulting server-side credential, and records connection state without enabling publishing.
- Approved content exposes an administrator-only unpublished Facebook test. Each attempt is RLS-protected, database-claimed, idempotent, retry-capped, and audited; the provider always sends `published=false` and cannot create a public Page-feed post.
- TikTok is represented as a review-required destination with an official Content Posting API implementation plan; no TikTok credentials or executable integration exist yet.
- The Marketing Agent can generate Brand-aware social posts, captions, and threads through the OpenAI Responses API with Structured Outputs. Blank Brand settings and signed logo URLs are omitted, unsupported claims are marked for research, and every successful call records tokens, latency, model, and estimated cost atomically with a fail-closed review draft. A server-only OpenAI API key is configured in the recovered, Git-ignored local environment; live calls still require operator action and budget headroom.
- The Marketing Agent also has a dedicated daily-briefing workflow modeled on the successful Nati Sports morning brief: a stronger configurable model performs live web research, verifies exact dates, ranks opportunities, creates non-redundant graphic directions and platform-native copy, and produces one publication-ready article/SEO package. Provider-returned source URLs are reconciled before storage, and the complete briefing enters the same fail-closed human review queue.
- OpenAI spending is protected by an application-wide $15 monthly cap. Every request must acquire an atomic database reservation before contacting OpenAI; a daily briefing reserves $0.45 and is limited to eight web-search calls, while a routine Luna draft reserves $0.01. Successful usage records the current official token/search estimate, failed requests conservatively consume the reservation, and new requests fail before the API call when budget is unavailable.

## In Progress

- Cross-user role and tenant-isolation integration coverage remains to be added against development Supabase.
- Nati Sports can add optional Brand context and upload its approved logo as useful; advanced Facts, rules, Sources, and Media Policy are no longer presented as routine onboarding requirements.

## Next Recommended Tasks

1. Add database-level safety functions/tests for sensitive Brand autonomy and publication-control changes.
2. Add repeatable cross-user integration tests for membership roles and tenant isolation.
3. Compare Nati Sports API briefings against the successful ChatGPT briefings using a small golden-output evaluation set.
4. Add controlled editing/resubmission, Source Packets, claim-level citations, and Fact Ledger foundations.
5. Add Instagram media handling and the full public Meta publication gate only after content verification and media-policy state can be completed safely; then add X compose handoff.

## Known Issues

- Brand and governance owner flows are live-tested; membership-role and review-decision behavior still need automated multi-user coverage.
- Authorization roles are foundational. Provider/job identities and privileged safety-setting mutation paths still need explicit policy decisions.
- Meta application credentials are configured only in the local development environment. At least one Brand has completed the development OAuth flow; production credentials and deployment configuration remain absent.
- A second non-owner test identity is needed to verify cross-tenant denial and each membership role.

## External Blockers

- Production hosting, DNS, and all publishing-provider credentials are intentionally not configured.

## Testing Status

Baseline passing locally on 2026-09-21: 27 unit tests, strict TypeScript check, ESLint, Next.js production build, and browser QA at desktop and 390px mobile widths. `npm audit` reported zero known vulnerabilities. On 2026-09-29, 54 unit tests, strict TypeScript, ESLint, the Next.js production build, and linked-schema lint pass; all committed migrations are applied to development Supabase. Provider tests prove the Facebook test request always includes `published=false`, while Agent tests prove signed asset URLs are omitted from prompts, provider sources are reconciled, briefing quality gates fail closed, and model/search cost estimates are deterministic. The user successfully completed the first unpublished Facebook test. At that September checkpoint, no OpenAI key had yet been configured; subsequent operator testing did consume API budget.

## Last Agent Handoff

- Agent: OpenAI Codex
- Objective: First-run repository foundation and Milestone 1 safety baseline.
- Important files changed: application scaffold, `src/data`, `src/lib/safety`, `src/lib/brands`, `src/lib/supabase`, Brand and governance UI, migrations, shared docs.
- Migrations: initial foundation, Brand/governance/source/media safety, explicit API grants, deletion-audit corrections, and approval functions are applied to development Supabase.
- Tests: 41 unit tests, typecheck, prior lint/build checkpoints, desktop/mobile shell browser QA, Brand Settings/Playbook browser QA, remote migration parity, and remote schema lint pass at their recorded checkpoints.
- Unresolved issues: automated cross-user membership/RLS coverage and the next product unit.
- Recommended next task: harden sensitive autonomy/publishing configuration at the database boundary, then implement the Approval Queue foundation.
