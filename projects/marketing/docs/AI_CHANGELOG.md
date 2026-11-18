# AI Changelog

## 2026-09-21

### Agent

OpenAI Codex

### Objective

Perform the first-run architecture and safety foundation for Valiantum Marketing OS.

### Changes

- Initialized repository configuration and shared multi-agent project documentation.
- Added the responsive application/navigation shell and clear setup/empty states.
- Added Supabase SSR/auth boundaries and an initial normalized schema with RLS.
- Tightened RLS after adversarial review so viewers cannot edit content or record approvals.
- Added deterministic automatic-publication eligibility logic and invariant tests.
- Kept every live publishing integration absent and all publication defaults off/manual.

### Tests

Passing: 17 unit tests, strict TypeScript check, ESLint, Next.js production build, and desktop/mobile browser QA. `npm audit` reports zero known vulnerabilities. SQL requires validation against a development Supabase project.

### Outstanding Issues

Validate the migration on a development Supabase instance and implement Brand CRUD as the next logical unit.

## 2026-09-21 — Brand CRUD checkpoint

### Agent

OpenAI Codex

### Objective

Implement the next Milestone 1 unit: secure Brand identity management.

### Changes

- Added a server-only Brand data layer with narrow DTOs and authenticated identity derivation.
- Added server-side validation, safe creation defaults, slug collision handling, and guarded deletion.
- Added Brand list, create, and detail/edit interfaces with an explicit setup state when Supabase is absent.
- Added database triggers for updated timestamps and immutable Brand mutation audit records.
- Corrected an RLS zero-row deletion edge case so unauthorized deletion fails closed.

### Tests

20 unit tests, strict typecheck, and lint pass. Production build verification is part of the checkpoint gate.

### Outstanding Issues

Brand CRUD and both migrations require integration validation against a development Supabase project. Next priority is Brand Facts and Brand Rules configuration.

## 2026-09-21 — Product Truth and Constitution checkpoint

### Agent

OpenAI Codex

### Objective

Implement administrator-controlled Brand Facts and structured Brand Constitution rules.

### Changes

- Added typed Brand Facts and Rules data access, validation, actions, and management UI.
- Required HTTP(S) sources before facts can be labeled SUPPORTED or VERIFIED.
- Rejected non-web URL schemes for both Brand websites and fact-source links.
- Added administrator-only, database-triggered audit history for Fact and Rule mutations.

### Tests

25 unit tests, strict typecheck, ESLint, and production build pass.

### Outstanding Issues

Governance mutations require integration validation against development Supabase. Source Hierarchy and Media Policy are next.

## 2026-09-21 — Source and media safety checkpoint

### Agent

OpenAI Codex

### Objective

Complete Brand-level source hierarchy and media-safety configuration.

### Changes

- Added Source Hierarchy data access, forms, tier validation, and audit trails.
- Enforced Tier 4 as discovery-only and required HTTP(S) URLs for approved factual sources.
- Added Media Policy configuration with safe defaults and an explicit UNSET state for AI real-person likenesses.
- Added audited, RLS-protected policy upserts without exposing a service credential.

### Tests

27 unit tests, strict typecheck, ESLint, and production build pass.

### Outstanding Issues

All database-backed configuration requires development Supabase integration validation. Sensitive autonomy/publishing mutation hardening and the Approval Queue are next.

## 2026-09-21 — Explicit Data API grants

### Agent

OpenAI Codex

### Objective

Support the operator's least-privilege Supabase project configuration with automatic table exposure disabled.

### Changes

- Added explicit authenticated table grants aligned to existing RLS policies.
- Revoked all application-table access from anonymous callers.
- Recorded that the development Supabase project exists but is not linked or migrated yet.

### Tests

Static review pending the first linked migration dry run.

### Outstanding Issues

The operator must add the project URL and publishable key locally, then authenticate and link the Supabase CLI.

## 2026-09-24 — Development Supabase deployment

### Agent

OpenAI Codex

### Objective

Connect the repository to the operator-created development Supabase project and validate the database foundation.

### Changes

- Validated the local public Supabase URL and publishable key without exposing or committing either value.
- Authenticated the Supabase CLI, linked the repository to `valiantum-marketing-os-dev`, and preserved local link metadata outside version control.
- Dry-ran and applied all five expected migrations, including explicit least-privilege Data API grants.
- Added local Supabase CLI configuration with automatic table exposure disabled and development redirect URLs aligned to the app.
- Replaced the incomplete hand-written database map with authoritative TypeScript types generated from the deployed schema.

### Tests

Local and remote migration histories match for all five migrations. Supabase linked-schema lint reports no errors. All 27 unit tests, strict TypeScript, and ESLint pass after the generated-type refresh. A production-build rerun is blocked on this host by Turbopack's inability to bind its internal process port; the prior production-build checkpoint remains passing.

### Outstanding Issues

Create or confirm the initial operator authentication user, then add authenticated browser/RLS integration coverage. Production hosting and all publishing-provider credentials remain intentionally unconfigured.

## 2026-09-24 — Authenticated integration checkpoint

### Agent

OpenAI Codex

### Objective

Exercise the connected application through its real login, RLS, governance, audit, and cleanup paths.

### Changes

- Moved the Next.js authentication Proxy alongside `src/app`, restoring unauthenticated redirects to `/login` under the documented Next.js 16 convention.
- Changed Brand creation to generate its UUID server-side and avoid a same-statement returned-row RLS visibility edge case.
- Added safe server-side database error logging while keeping detailed errors out of browser responses.
- Corrected Brand and governance deletion audit triggers so deleted identifiers are preserved in metadata without violating live foreign keys.
- Replaced stale hard-coded setup messaging with configuration-aware connected/setup states.

### Tests

- Verified unauthenticated protected routes redirect to `/login` and anonymous Data API reads fail with `401` / PostgreSQL `42501`.
- Signed in through the application and created a temporary Brand with manual autonomy and publishing disabled.
- Created a Fact, Constitution Rule, approved Tier 1 Source, and fail-closed Media Policy under owner RLS.
- Deleted the temporary Brand and its cascading governance records after validating the corrected audit triggers; the workspace returned to zero Brands.
- Unit tests, strict TypeScript, ESLint, migration parity, and linked-schema lint are rerun as part of this checkpoint.

### Outstanding Issues

Repeatable multi-user tests are still required for OWNER, ADMIN, EDITOR, REVIEWER, and VIEWER isolation. Production hosting and live publishing remain intentionally unconfigured.

## 2026-09-24 — Approval Queue foundation

### Agent

OpenAI Codex

### Objective

Implement the first complete human content-review workflow without weakening publication safeguards.

### Changes

- Added validated Content submission with an explicit initial review state and fail-closed verification, risk, approval, claim, and media defaults.
- Revoked direct authenticated content insert/update and approval insert privileges.
- Added role-checked database functions for content submission and atomic approve/reject decisions.
- Serialized concurrent decisions with a row lock and required reviewer reasoning for rejection.
- Recorded content creation and human decisions in immutable audit logs.
- Added Approval Queue, content submission, review detail, Brand Facts and Source context, safety checks, decision history, and responsive controls.
- Connected the dashboard's awaiting-approval metric to live content state.

### Tests

33 unit tests, strict TypeScript, and ESLint pass. The linked schema linter reports no errors, and local/remote migration histories match. Authenticated empty-queue and zero-Brand submission states were browser-verified.

### Outstanding Issues

Multi-user tests remain required for OWNER, ADMIN, EDITOR, REVIEWER, and VIEWER behavior. Editing, resubmission, regeneration, scheduling, and publishing remain intentionally outside this foundation slice.

## 2026-09-24 — Live approval verification and dashboard state

### Agent

OpenAI Codex

### Objective

Verify the Approval Queue against the operator-created Nati Sports Brand and remove stale first-run dashboard guidance.

### Changes

- Submitted a clearly labeled non-publishable workflow-verification draft through the authenticated application.
- Confirmed fail-closed review metadata, Brand context, empty truth/source warnings, and required human controls.
- Rejected the draft with required reviewer reasoning and preserved it in immutable recent-decision history.
- Updated the dashboard to read live Brand state, complete the first-Brand checklist item, and offer content submission without claiming that no Brands exist.

### Tests

- Verified the pending dashboard count moved from zero to one after submission and returned to zero after rejection.
- Verified the rejected decision and reasoning appear in Approval Queue history and the decision form is no longer available.
- Unit tests, strict TypeScript, and ESLint are rerun as part of this checkpoint.

### Outstanding Issues

Nati Sports has no authoritative Facts, Constitution rules, approved Sources, or explicit Media Policy yet. Those controls should be configured before factual content is generated or relied upon.

## 2026-09-24 — Optional Brand Settings onboarding

### Agent

OpenAI Codex

### Objective

Replace manual Fact-led onboarding with an optional, plain-language Brand Settings experience.

### Changes

- Made it explicit that only Brand name and slug are required.
- Added optional coverage/content pillars, marketing goals, and special Agent instructions using existing database fields.
- Reframed existing website, category, description, audience, and voice inputs with clear descriptions and optional labels.
- Added Brand Settings navigation and context summaries to the Settings and Marketing Agent pages.
- Moved claim-level evidence, rules, Sources, and Media Policy behind an advanced-safeguards entry point.
- Added a typed Agent-context builder that excludes every blank optional field.
- Added an explicit save confirmation and revalidation for Dashboard, Settings, and Agent views.

### Tests

- Added tests proving empty settings are omitted and line-based fields are normalized.
- Verified the live Nati Sports Settings page renders all existing values, optional fields, guidance, and advanced-safeguard separation.

### Outstanding Issues

The Marketing Agent does not make AI calls yet. When generation is implemented, it must use the tested context builder and continue treating absent safety permissions as denied rather than ignored.

### Follow-up correction

- Removed the Advanced Settings link that still exposed the old manual Fact/rule/source form.
- Redirected existing `/governance` bookmarks to the corresponding Brand Settings page so the former onboarding interface cannot reappear.

## 2026-09-26 — Consolidated Brand Settings and private logo assets

### Agent

OpenAI Codex

### Objective

Put the actual Brand forms on Settings and give the Marketing Agent an approved Brand logo for future graphic creation.

### Changes

- Moved Brand identity, optional Agent guidance, logo management, and deletion controls directly onto Settings.
- Redirected legacy Brand-detail and governance URLs to the matching Settings view.
- Added private PNG, JPEG, and WebP logo upload, replacement, removal, server-side signature validation, and a 5 MB limit.
- Added Brand-scoped Storage policies and a constrained stable logo path on each Brand.
- Displayed logos in the Brands workspace with an initials fallback.
- Added short-lived signed logo URLs to populated Agent context while continuing to omit blank settings.

### Safety

- The logo bucket is private; no service-role credential is used.
- Object reads and writes are restricted by Brand access/edit checks and stable per-Brand paths.
- Unsupported, oversized, and MIME-spoofed files are rejected before upload.

## 2026-09-27 — Optional Brand Playbook

### Agent

OpenAI Codex

### Objective

Give each unique Brand enough structured context for higher-quality, lower-supervision content without turning setup into a required questionnaire.

### Changes

- Added six expandable Settings sections for strategy and proof, audience intelligence, channels and conversion, language and examples, visual direction, and sources and hard guardrails.
- Added optional fields for mission, positioning, offers, differentiators, proof points, needs, objections, channels, formats, calls to action, approved and avoided vocabulary, official sources, disclosures, prohibited claims, and positive/negative examples.
- Stored populated Playbook values in a compact JSON profile and added typed parsing for older or malformed data.
- Expanded Agent context into structured Playbook groups while continuing to omit all blank values.
- Added source-URL validation and tests for empty, populated, normalized, and malformed Playbook input.

### Safety

- Playbook proof points and preferred source URLs are guidance, not automatic verification or publication approval.
- Existing manual autonomy and publishing-off defaults remain unchanged.

## 2026-09-29 — Safe Meta provider test foundation

### Agent

OpenAI Codex

### Objective

Add the first end-to-end Meta provider execution path without enabling or testing public publishing.

### Changes

- Added a common publishing-provider contract and a Facebook Page implementation whose only operation hard-codes `published=false`.
- Added RLS-protected publication attempts with stable idempotency keys, a three-attempt cap, immutable audit events, and no direct authenticated writes.
- Added security-definer claim/completion functions that re-check authentication, Brand-admin authority, approved content state, destination connection, and credential expiry.
- Decrypt Meta credentials only in the server-side publication service and reject a Page-ID mismatch before calling Meta.
- Added an approved-content control for explicitly creating an unpublished Facebook test plus attempt history and operator-safe errors.
- Kept Instagram publishing unavailable until a public media-delivery pipeline and media-policy checks exist.

### Tests

- 46 unit tests pass, including proof that the Facebook request contains `published=false` and that empty or rejected requests fail closed.
- Strict TypeScript, ESLint, and the Next.js production build pass.
- The migration is deployed to the linked development Supabase project and the remote schema linter reports no errors.
- No provider request or external test post was created during automated testing.

### Outstanding Issues

The operator must explicitly choose an approved content item to run the first unpublished Facebook test. Public Facebook publishing, Instagram media publishing, background jobs, scheduling, and status reconciliation remain disabled.

### Live verification

The operator ran the explicit test from an approved content item. Meta returned success, the attempt remained unpublished, and the application recorded `SUCCEEDED` on attempt 1.

## 2026-09-29 — Brand-aware AI review drafts

### Agent

OpenAI Codex

### Changes

- Added the official OpenAI JavaScript SDK and Responses API Structured Outputs for social posts, captions, and threads.
- Routed generation through populated Brand Settings and Playbook context while excluding signed logo URLs from text prompts.
- Added explicit instructions and structured metadata for unsupported, current, or uncertain claims that require research.
- Added an atomic database function that stores the draft, AI token usage, latency, estimated cost, and audit event together.
- Forced every AI draft into human review with unverified, medium-risk, and incomplete media-policy defaults.
- Added a Marketing Agent form that remains disabled until a server-only OpenAI API key is configured.

### Tests

48 unit tests, strict TypeScript, and ESLint pass. No OpenAI API request was made and no API cost was incurred.

### Outstanding Issues

The operator must add an OpenAI API key outside source control before the first live draft can be generated. Cost estimates are currently defined for the default `gpt-6-luna` model; unknown model overrides record zero estimated cost until a reviewed price entry is added.

## 2026-09-29 — Research-first daily briefing pipeline

### Agent

OpenAI Codex

### Objective

Reproduce the observable research, editorial judgment, verification discipline, platform adaptation, and full article packaging that made the Nati Sports ChatGPT scheduled briefings successful.

### Changes

- Added a first-class daily briefing form to the Marketing Agent instead of treating the workflow as a generic one-post prompt.
- Added a separate configurable `gpt-6.1-sol` default for briefings while retaining `gpt-6-luna` for lower-cost routine drafts.
- Added live Responses API web search with exact-date checks, primary-source preference, omission of unverified details, ranked opportunities, distinct graphic concepts, native Facebook/Instagram/X copy, and one full article/SEO package.
- Reconciled every model-supplied source URL against provider-returned web-search metadata and fail the run when no verifiable web source is returned.
- Added a deterministic pre-storage quality contract for requested-date fidelity, source coverage, unique rankings and graphic concepts, unique SEO keywords, and article heading structure.
- Added atomic briefing storage, token/latency/model usage, prompt version, provider source ledger, and an immutable audit event.
- Kept every generated briefing unverified, medium-risk, media-policy-incomplete, and human-review-required. The workflow cannot publish or schedule content.

### Outstanding Issues

The server-only OpenAI API key is still required before live generation. The first live Nati Sports output must be compared with known successful briefings before scheduling is added. Model token cost remains recorded as zero until current pricing for the configured briefing model is explicitly reviewed and encoded.

### Tests

54 unit tests, strict TypeScript, ESLint, the Next.js production build, and linked-schema lint pass. The migration is deployed to the linked development project. No OpenAI API request was made and no API cost was incurred.

## 2026-09-29 — Hard $15 monthly OpenAI budget

### Agent

OpenAI Codex

### Objective

Keep all Valiantum OpenAI API usage within the operator's $15 monthly ceiling without materially reducing the quality of the daily Nati Sports briefing.

### Changes

- Added an application-wide $15 monthly budget to immutable system safety state.
- Added atomic pre-request reservations so concurrent requests cannot race past the cap.
- Reserved at most $0.45 for a daily briefing and $0.01 for a routine Luna draft before any OpenAI request is sent.
- Limited each daily briefing to eight web-search tool calls, reduced search context from high to medium, and reduced the output ceiling from 12,000 to 9,000 tokens while retaining GPT-6.1 Sol at medium reasoning.
- Added current official GPT-6.1 Sol, GPT-6 Luna, and web-search cost estimation to the usage ledger.
- Conservatively charges the full reservation after a failed request so failures cannot silently defeat the safety cap.
- Added a visible monthly remaining/used budget summary to the Marketing Agent page.

### Safety

This is an application-side guard based on API-reported token usage and tool calls. The OpenAI project should also have a $15 platform budget or usage limit for defense in depth.

### Tests

54 unit tests, strict TypeScript, ESLint, the Next.js production build, linked-schema lint, and local/remote migration parity pass. No OpenAI API request was made and no API cost was incurred.
