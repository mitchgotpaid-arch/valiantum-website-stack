# Architecture Decisions

## Decision: Use a modular Next.js monolith for the foundation

### Reason

The current product is private and early-stage. Next.js server modules, Supabase, and scheduled/event-driven workers can support the initial workload without premature microservices.

### Alternatives Considered

Separate frontend/API services; multiple worker services from day one.

### Consequences

Business logic must stay in small server-side modules so jobs or provider integrations can later move without rewriting UI code.

### Date

2026-09-21

## Decision: Route approval-sensitive mutations through database functions

### Reason

Content status, verification, risk, media eligibility, and human decisions directly affect publication safety. Broad client table grants could let a compromised or buggy client bypass workflow rules.

### Alternatives Considered

Direct table inserts/updates guarded only by RLS; application-only transaction sequencing.

### Consequences

Authenticated clients may read authorized content and approvals but cannot directly insert or update them. Narrow security-definer functions re-check Brand roles, set fail-closed defaults, serialize competing decisions, write the content transition and approval atomically, and record an audit event. New workflow transitions require explicit database functions and migration review.

### Date

2026-09-24

## Decision: Keep Brand logos private and manage the Brand profile on Settings

### Reason

Brand setup should be a single, understandable workflow. The Marketing Agent also needs an approved visual asset without making Brand files public or embedding long-lived credentials in prompts.

### Alternatives Considered

Keep a separate Brand-detail settings route; store public logo URLs; accept unrestricted files; require manual storage configuration outside the app.

### Consequences

Settings contains the logo and all optional Brand fields. Logos are limited to validated PNG, JPEG, or WebP files up to 5 MB, stored in a private Brand-scoped bucket, and exposed only through expiring signed URLs. The durable Agent data is the private object path; a fresh signed URL is created when Brand context is loaded. Existing Brand-detail and governance bookmarks redirect to Settings.

### Date

2026-09-26

## Decision: Use a progressive, optional Brand Playbook for autonomy context

### Reason

Every Brand needs distinct strategy, audience, editorial, visual, distribution, and risk guidance, but requiring all of it during onboarding would recreate the manual-work problem. Autonomous content quality improves when the Agent can learn from structured preferences and concrete examples instead of one catch-all prompt.

### Alternatives Considered

Add dozens of required columns; use only one freeform instruction field; infer missing Brand strategy automatically; send empty fields to the Agent.

### Consequences

The Settings form exposes expandable Playbook sections whose fields are all optional. Populated values are compacted into one validated JSON object and transformed into typed, grouped Agent context. Blank values are omitted. User-entered proof points and source URLs guide research but do not bypass claim verification or publication safeguards.

### Date

2026-09-27

## Decision: Make publication eligibility deterministic and fail-closed

### Reason

Prompts and model outputs cannot enforce authority. A pure policy engine is inspectable, testable, and reusable by future job and provider layers.

### Alternatives Considered

Prompt-only checks; provider-specific validation.

### Consequences

Every future publisher must call the central policy gate and record its decision. Global auto-publish and brand publishing default OFF.

### Date

2026-09-21

## Decision: Use Supabase Auth plus PostgreSQL RLS for tenant isolation

### Reason

RLS creates a database security boundary in addition to server-side checks and fits the requested stack.

### Alternatives Considered

Application-only authorization; a custom authentication service.

### Consequences

Every new brand-scoped table needs explicit RLS policies and authorization tests. Service-role use, if introduced, must remain server-only and narrowly scoped.

### Date

2026-09-21

## Decision: Keep Brand onboarding optional and omit blank Agent context

### Reason

Manually constructing a Fact Ledger creates unnecessary onboarding work for ordinary Brand identity, audience, coverage, goals, voice, and operating preferences. Empty fields should represent absent guidance, not facts for an Agent to infer.

### Alternatives Considered

Require sourced Facts before using a Brand; send empty settings to prompts; make every onboarding field mandatory.

### Consequences

Only Brand name and slug are required. Optional plain-language settings are stored in the existing Brand profile and included in Agent context only when populated. Claim-level Facts, enforceable rules, source hierarchy, and media controls remain available as advanced safeguards. Missing safety-critical permissions still fail closed and are never interpreted as approval.

### Date

2026-09-24
