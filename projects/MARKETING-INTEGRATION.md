# Projects + Marketing OS

One Hostinger Node application serves Projects at `/` and Marketing OS at `/marketing`. The root entry is still `server.js`. `npm install` builds the Marketing module automatically; `npm run build` rebuilds it explicitly. Node 22+ is required. The Next handler initializes lazily so Projects can start immediately.

## Existing data and sign-in

Projects keeps its existing MySQL workspace and owner sign-in. Marketing keeps its existing Supabase database, users, brands, drafts, roles, review queue, AI budget controls, and provider credentials. No data is copied or deleted by this merge. The original Marketing repository is retained as a source reference; future integrated work belongs in this repository.

The full `/marketing` application requires the Projects session, followed by the existing Marketing account. The exact Meta OAuth callback is allowed through the outer gate because browsers omit the Strict Projects cookie on the provider's return; the callback still validates the Supabase user, OAuth state, and brand administrator rights. Do not broaden that exception.

## Production connection

Use the SAME Supabase project already used by localhost Marketing OS. In Hostinger's environment settings add:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable/anon key, never service-role)
- `NEXT_PUBLIC_APP_URL=https://projects.valiantum.com`

Preserve all existing Projects/MySQL variables. Copy the existing optional server-side OpenAI and Meta configuration only if those capabilities are needed. Never commit `.env` files. Restart/redeploy after setting variables. Authentication is checked per request; configuration changes require a rebuild/restart; the base path is fixed at build time.

For an existing Marketing OS database, apply the new card bridge `20261117220000_project_card_bridge.sql` and safety-control grant restriction `20261118010000_lock_brand_safety_controls.sql` from `marketing/supabase/migrations/`, if they are not already in migration history. Both were applied during this integration. The earlier migrations are preserved for provenance and fresh development setup; do not re-run them against an existing database. Verify migration history first. The bridge migration adds an owner-readable bridge table and two narrow authenticated RPCs. Import uses the existing audited review creation function, keeps human approval required, and prevents duplicate imports. It does not enable publishing.

If Meta is used, add the exact redirect URI `https://projects.valiantum.com/marketing/api/meta/callback` in the Meta developer application. Preserve the existing API version/configuration. Supabase password login needs the existing account; do not enable public signup.

## Workflow

Open a saved card and choose **Send saved card to Marketing OS**. Select an editable brand, review the snapshot, and send it. The action sends the saved version, not unsaved editor changes. Sending twice opens the same review brief. Subsequent card edits do not overwrite marketing review content. Marketing review status appears on the source card after returning to Projects or refocusing the window; it never changes the card's manually chosen project stage.

The Project briefs page links back to the source project and forward to content review. AI generation remains an explicit Marketing Agent action with the existing budget guard. Sending a card itself incurs no AI call and does not publish content.

## Validation

- `npm test`: Projects persistence/authentication plus private Marketing mount and raw request handling.
- `npm run test:marketing`: Marketing policy, AI/budget, and bridge schema tests.
- `npm run test:marketing-db`: isolated Postgres migration and access-control checks.
- `npm run typecheck:marketing`
- `npm run build`

Phone checks cover 320px and 390px layouts. Database integration checks exercise actual migration SQL in an isolated Postgres engine: owner import, viewer/unrelated-user denial, anonymous denial, direct-write denial, retry idempotency, safe review defaults, and updated status reads. These are local checks; production is not connected until the existing Supabase settings and migration are configured.

See [SECURITY-REVIEW.md](SECURITY-REVIEW.md) for security findings, applied hardening and verification limits. A deployment intentionally invalidates current Projects sessions. Public Supabase settings are required at build time and in the runtime environment; changing hosting settings rebuilds the module.
