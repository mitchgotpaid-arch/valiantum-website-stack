# Architecture

## Status Key

- **Implemented** means code exists in this repository.
- **Planned** means intended design only.

## Frontend

**Implemented:** Next.js App Router with React, strict TypeScript, Tailwind CSS, a responsive SaaS shell, and setup/empty states for all primary navigation routes.

**Implemented:** Brand list, create, optional Brand Settings, private logo upload, expandable Brand Playbook, and guarded delete screens. The editable profile, logo, and deletion controls live directly on the Settings page. Only the Brand name and slug are required; empty optional settings are omitted from Agent context. The Playbook adds structured strategy, offers, proof points, audience intelligence, distribution preferences, editorial language, official sources, visual direction, hard guardrails, and good/bad examples without making onboarding mandatory. A populated logo is resolved to a short-lived signed URL for Agent context and Brand-workspace display. The former manual governance URL redirects to Brand Settings so Fact keys and source URLs are not part of normal onboarding. The underlying Product Truth, Constitution, Source Hierarchy, and Media Policy records remain available to the review system. Without database configuration, the Brand workspace explicitly stays in setup mode.

**Planned:** Content workspace, approval details, calendar, campaigns, agent actions, analytics, and settings controls.

## Backend

**Implemented:** Next.js server actions/server modules provide the server boundary. Login, Brand, Content, and review-decision inputs are validated server-side. A `server-only` data layer re-derives user identity from Supabase Auth and returns narrow DTOs. Secrets are not imported into client components.

**Implemented:** Content submission and human decisions use narrow database functions rather than direct safety-sensitive table writes.

**Planned:** Validated service modules for content editing/resubmission, jobs, AI calls, and publishing providers.

## Database

**Implemented:** Applied Supabase/PostgreSQL migrations define multi-brand foundation entities, enums, indexes, constraints, global auto-publish default OFF, brand publishing default OFF, manual autonomy default, initial RLS policies, updated timestamps, and Brand/governance audit triggers. Brand logos use a private, MIME- and size-restricted Storage bucket with Brand-scoped object policies; the Brand row stores only the stable object path. The repository is linked to the development project, and generated TypeScript types reflect its deployed schema.

Brand Facts store values as JSON for future typed values; the current UI writes `{ "value": string }`. SUPPORTED and VERIFIED entries require an HTTP(S) source URL. Constitution rules are structured as ALWAYS, NEVER, or REQUIRE_REVIEW.

Source records use tiers 1–4. The application rejects Tier 4 factual approval and requires HTTP(S) URLs for approved sources. Media policy preserves a nullable real-person-likeness choice; null means not configured and must fail publication eligibility rather than imply permission.

**Implemented:** Review-ready content enters with NEEDS_REVIEW, UNVERIFIED, MEDIUM risk, human approval required, and media policy unsatisfied. Review decisions lock the content row, authorize the reviewer role, insert the immutable decision, transition status, and write the audit event in one transaction.

**Planned:** Source packets, fact claims, campaigns, content variants, schedules, jobs/idempotency, provider accounts, media, analytics, and additional server-controlled safety procedures.

## Authentication and Authorization

**Implemented:** Supabase SSR clients, session refresh proxy at the required `src/proxy.ts` boundary, email/password login action, protected routes when Supabase is configured, and setup-mode access when it is absent. RLS uses ownership/membership helpers. Authenticated owner writes and anonymous denial are validated against development Supabase.

**Implemented:** OWNER, ADMIN, and REVIEWER authority is required by the database before recording a review decision; direct approval inserts are revoked.

**Planned:** Invite/user administration, sign-out, password recovery, MFA policy, and end-to-end cross-user authorization tests.

## Publication Safety

**Implemented:** A pure, deterministic eligibility function rejects automatic publication when global or brand publishing is off, autonomy is manual, content is blocked/unverified, approval is missing/rejected, claims/media fail policy, publication is duplicate, credentials/idempotency are missing, or the hard AI budget is exceeded.

**Implemented:** The first provider execution gate permits only an administrator-requested, unpublished Facebook Page test for approved content. The database claims each attempt atomically, supplies a stable idempotency key, caps retries, and records request/outcome audit events. The provider itself hard-codes `published=false`.

**Planned:** Public-publication eligibility snapshots, database-side privileged configuration changes, full Fact Ledger, risk engine, verification pipeline, and live provider execution gates.

## AI, Research, and Verification

**Implemented:** A typed Brand-context builder includes only populated settings and populated Playbook groups. The first Writer path uses the OpenAI Responses API with Structured Outputs, a centrally configured low-cost model, explicit unsupported-claim markers, and atomic content/usage/audit persistence. Generated content always enters `NEEDS_REVIEW`, `UNVERIFIED`, medium risk, and incomplete media-policy state. The feature is disabled when the server-only API key is absent.

**Planned:** Specialized director/research/fact-checker/brand-review roles, prompt/version evaluation, richer model routing, and failure-usage telemetry. Retrieved material remains untrusted data. Writers receive source packets rather than relying on model memory.

## Jobs and Publishing

**Implemented:** Per-Brand publishing-destination metadata establishes Facebook Page and Instagram Professional channels through Meta, while X is configured as a manual handoff with no API credential or usage cost. Meta OAuth uses state validation, server-side credential encryption, Brand-admin authorization, and account discovery. Publication attempts are RLS-protected, audit-backed, retry-limited, and idempotent. The only executable provider operation is an explicit unpublished Facebook test.

**Planned:** Instagram media containers, public Meta publishing gates, event-driven workers, scheduling, status reconciliation, and X compose handoff. Real public publishing remains disabled until the verification, media, review, and safety gates are complete.

## Security Boundaries

- Browser code receives only the Supabase URL and publishable key.
- Brand logos remain private and are displayed or passed to the Agent using expiring signed URLs.
- Service-role credentials are not defined or used.
- RLS is enabled on all initial application tables.
- Automatic Data API table exposure is disabled; migrations grant authenticated operations explicitly and grant anonymous users no application-table access.
- Deletion audit triggers store removed Brand identifiers in immutable metadata when no live foreign-key target remains, allowing safe cascading cleanup without losing traceability.
- Automatic publishing defaults to fail-closed at both global and brand levels.
- External data must never be promoted to system/user instructions.
- Real public publishing must never be used as an automated test.

## Primary Data Flow (Planned)

Idea → research → source packet → draft → claim extraction → verification → brand/media review → risk → approval policy → schedule → privileged publication gate → provider → audit/analytics.
