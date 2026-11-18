# Valiantum Projects + Marketing OS security review

Reviewed November 17, 2026. Scope: the Projects Express app, merged Next Marketing module, current Supabase schema and privileges, production hosting configuration, and public HTTP boundaries. This is source review plus targeted local and live verification, not an independent penetration-test certification.

## Findings addressed

- **Public Supabase signup was enabled.** Disabled it on the dedicated Marketing OS project and verified `disable_signup=true` through the public Auth settings endpoint. Anonymous sign-in is disabled, email confirmation remains enabled, and the database contains one existing account.
- **Marketing sign-in could produce a server error.** A missing Supabase session raised `AuthenticationRequiredError` during rendering. Restored build-time public configuration in the proxy, added server-page authentication guards that redirect before loading private data, kept API authentication failures as JSON 401, and made redirects use the canonical public origin. A configured-runtime smoke test covers this exact failure.
- **Marketing lacked a restrictive browser script policy.** Added a fresh cryptographic nonce per response, nonce-protected Next bootstrap scripts, production restrictions on script execution, `object-src 'none'`, frame protection, restricted connections, and allowed image sources. Inline styles remain permitted for existing React UI styling; inline scripts require the nonce.
- **Server-only Supabase tokens used browser-readable cookie defaults.** Cookies now require HttpOnly, SameSite=Lax, and Secure in production. Projects uses a Secure, HttpOnly, SameSite=Strict, host-only `__Host-` session cookie. No browser Supabase client depends on reading tokens.
- **Marketing mutations relied on route/framework CSRF handling.** The outer Express gate now rejects every Marketing POST/PUT/PATCH/DELETE with a missing, null, or foreign Origin while preserving legitimate multipart server actions. The JSON bridge also checks content type and origin.
- **Brief size was checked only after buffering.** Incoming JSON is now bounded by actual streamed bytes, independent of a missing or dishonest Content-Length header, and oversized streams are cancelled before parsing.
- **Brand safety fields had broad authenticated UPDATE grants.** Applied a migration restricting direct updates to normal brand-editing fields. Ownership, publishing, autonomy and budget controls cannot be changed through ordinary authenticated brand updates. Existing settings remain unchanged and publishing stays disabled.
- **Meta reconnect retained an unprefixed route and mismatched cookie deletion path.** Corrected the `/marketing` connect URL and OAuth cookie cleanup, and reject future-dated OAuth state. The exact OAuth callback exception remains constrained by Marketing authentication, state, expiry and brand administrator checks.
- **Provider error messages could enter logs.** Daily-briefing logs now retain the exception category rather than raw provider message text.

## Verification

- Projects authentication, throttling, origin checks, session invalidation, persistence, conflicts and legacy data behavior pass automated checks.
- Production session flags and host-only naming, forged Next headers, private routes, CSP nonce uniqueness, origin rejection, and logout are covered by regression tests.
- Marketing unit tests and strict application/test TypeScript checks pass, including missing-session page redirects, token cookie flags, streamed UTF-8 limits, content policy, encrypted credential tampering and briefing handoff validation.
- The full application migration chain runs in isolated Postgres with synthetic Supabase Auth/Storage schemas. Owner/editor/reviewer/viewer/unrelated-user/anonymous cases verify import/review permissions, retry idempotency, owner-scoped bridge reads, cross-brand denial, private credential denial, private logo isolation and blocked direct changes to publication-sensitive data.
- Live SQL audit: no public application tables without RLS; no application tables readable by anon; no authenticated usage of the private credential schema; no public brand asset bucket; one account; global and brand public publishing disabled; direct authenticated publish-flag updates denied.
- Public HTTPS requests to workspace/export/marketing APIs require authentication. Anonymous Supabase requests to brands, content, approvals, audit, AI usage and card briefs return 401. Environment paths are blocked. Public frontend JavaScript is code only and contains no stored project data.
- TLS certificate validates, and the tested connection negotiates TLS 1.3. Login responses carry no-store, HSTS, nosniff, noindex, frame protection and a restrictive CSP.
- A production build with the configured server credentials is scanned without printing secret values: no current OpenAI or Meta secret appears in client assets, tracked/unignored source, or the Projects repository history examined. Production dependency installation reports zero known vulnerabilities.

## Remaining limits

- Development-only lint/test tooling has an upstream picomatch denial-of-service advisory (reported through 16 transitive packages). Those packages are absent from the deployed production install, and the application does not accept user-controlled glob patterns. No forced toolchain downgrade was applied.
- Hosting/Supabase/GitHub account MFA, recovery procedures, independent infrastructure testing, and backup restoration drills are outside these application checks. Maintain account MFA and tested backups.
- The AI budget guard tracks conservative application estimates; it is not an OpenAI billing limit. No paid AI generation or provider publication was performed during this review.
- Projects sessions/throttles are in memory: keep one application instance. Deployments deliberately sign out current Projects sessions. Physical iPhone/Android keyboard behavior still needs device testing, though responsive layouts were checked at 320 and 390px.
