# Roadmap

## Current launch focus (2026-10-06)

The first shipping unit is a researched briefing that can produce separate, editable, source-linked Facebook, Instagram, and manual-X drafts without another AI request. The code is complete locally, but its database migration must be applied and smoke-tested before use. Public Facebook and Instagram publishing remain disabled; the next gate is human-verifiable claims, media readiness, and one-at-a-time approved publication with durable provider status.

## Phase 1 — Foundation — IN PROGRESS

- COMPLETE: repository memory, Next.js shell, deterministic safety engine baseline.
- COMPLETE: Supabase schema/auth/RLS foundation deployed to the linked development project; owner flows and anonymous denial are live-tested.
- COMPLETE: Brand identity CRUD with safe defaults, validation, RLS-backed access, and audit triggers.
- COMPLETE: Brand Facts and Brand Constitution configuration with structured validation and audit trails.
- COMPLETE: Source Hierarchy and Media Policy configuration with fail-closed real-person likeness state and audited changes.
- COMPLETE: Approval Queue foundation with controlled content submission, role-checked atomic decisions, evidence context, and audit-backed history.
- IN PROGRESS: full safety-invariant and authorization integration tests; multi-user role isolation remains.

## Phase 2 — AI Content Creation — IN PROGRESS

Brand-aware social draft generation now uses structured outputs, centralized low-cost model configuration, atomic AI usage/cost recording, and mandatory human review. A separate research-director workflow uses live web search and a stronger configurable model to create ranked daily opportunities, platform-native copy, distinct graphic directions, and one complete article/SEO package. An application-wide $15 monthly cap is reserved atomically before any OpenAI request, with briefings limited to eight web-search tool calls and $0.45 of reserved budget. The server-only OpenAI key is present in the Git-ignored local environment, and the user has exercised live generation. Routing/evaluations, regeneration, and additional review agents remain; audited editing and resubmission are coded but await the development migration.

## Phase 3 — Research & Verification — IN PROGRESS

Daily briefings now require provider-returned web sources, reconcile model citations against provider metadata, and record the source ledger in the audit event. Claim-level verification, reusable Source Packets, and a Fact Ledger remain.

## Phase 4 — WordPress — NOT STARTED

Depends on publishing readiness review. Initial external behavior will be draft-only.

## Phase 5 — Meta — IN PROGRESS

Publishing-destination metadata, Brand Settings status, OAuth security, encrypted credentials, single-Page account discovery, durable publication attempts, idempotency, and an explicit unpublished Facebook provider test are deployed. No public post can be created by this path. Instagram media publishing, richer account selection, background execution, scheduling, status reconciliation, and public-publishing readiness review remain.

## Phase 6 — Additional Social Platforms — NOT STARTED

X is intentionally manual-only to avoid API cost. Valiantum will prepare content and hand it to X for a human final post; other platforms still require separate capability and cost review.

## Phase 7 — Campaign Automation — NOT STARTED

Depends on safe content creation and scheduling.

## Phase 8 — Analytics — NOT STARTED

Depends on provider integrations and normalized metric definitions.

## Phase 9 — Increased Autonomy — BLOCKED

Blocked until substantial real-world validation. Human must explicitly enable any automatic publishing.
