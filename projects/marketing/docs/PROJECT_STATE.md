# Project State

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
- The Marketing Agent can generate Brand-aware social posts, captions, and threads through the OpenAI Responses API with Structured Outputs. Blank Brand settings and signed logo URLs are omitted, unsupported claims are marked for research, and every successful call records tokens, latency, model, and estimated cost atomically with a fail-closed review draft. The control remains disabled until a server-only OpenAI API key is configured.
- The Marketing Agent also has a dedicated daily-briefing workflow modeled on the successful Nati Sports morning brief: a stronger configurable model performs live web research, verifies exact dates, ranks opportunities, creates non-redundant graphic directions and platform-native copy, and produces one publication-ready article/SEO package. Provider-returned source URLs are reconciled before storage, and the complete briefing enters the same fail-closed human review queue.
- OpenAI spending is protected by an application-wide $15 monthly cap. Every request must acquire an atomic database reservation before contacting OpenAI; a daily briefing reserves $0.45 and is limited to eight web-search calls, while a routine Luna draft reserves $0.01. Successful usage records the current official token/search estimate, failed requests conservatively consume the reservation, and new requests fail before the API call when budget is unavailable.

## In Progress

- Cross-user role and tenant-isolation integration coverage remains to be added against development Supabase.
- Nati Sports can add optional Brand context and upload its approved logo as useful; advanced Facts, rules, Sources, and Media Policy are no longer presented as routine onboarding requirements.

## Next Recommended Tasks

1. Add database-level safety functions/tests for sensitive Brand autonomy and publication-control changes.
2. Add repeatable cross-user integration tests for membership roles and tenant isolation.
3. Configure the server-only OpenAI key, run the first Nati Sports daily briefing, and compare it against the successful ChatGPT briefings using a small golden-output evaluation set.
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

Baseline passing locally on 2026-09-21: 27 unit tests, strict TypeScript check, ESLint, Next.js production build, and browser QA at desktop and 390px mobile widths. `npm audit` reported zero known vulnerabilities. On 2026-09-29, 54 unit tests, strict TypeScript, ESLint, the Next.js production build, and linked-schema lint pass; all committed migrations are applied to development Supabase. Provider tests prove the Facebook test request always includes `published=false`, while Agent tests prove signed asset URLs are omitted from prompts, provider sources are reconciled, briefing quality gates fail closed, and model/search cost estimates are deterministic. The user successfully completed the first unpublished Facebook test. No OpenAI API call has been made because no key is configured.

## Last Agent Handoff

- Agent: OpenAI Codex
- Objective: First-run repository foundation and Milestone 1 safety baseline.
- Important files changed: application scaffold, `src/data`, `src/lib/safety`, `src/lib/brands`, `src/lib/supabase`, Brand and governance UI, migrations, shared docs.
- Migrations: initial foundation, Brand/governance/source/media safety, explicit API grants, deletion-audit corrections, and approval functions are applied to development Supabase.
- Tests: 41 unit tests, typecheck, prior lint/build checkpoints, desktop/mobile shell browser QA, Brand Settings/Playbook browser QA, remote migration parity, and remote schema lint pass at their recorded checkpoints.
- Unresolved issues: automated cross-user membership/RLS coverage and the next product unit.
- Recommended next task: harden sensitive autonomy/publishing configuration at the database boundary, then implement the Approval Queue foundation.
