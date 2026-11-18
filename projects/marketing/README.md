# Valiantum Marketing OS

Private, multi-brand marketing operations software—a safety-first marketing brain for apps, websites, and social channels. The current milestone establishes the application shell, authentication/database boundaries, and deterministic publication-safety controls. Public publishing remains intentionally disabled; an explicit unpublished Facebook provider test is available for approved content.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and provide a Supabase project URL and publishable key.
3. Link the Supabase CLI and apply any pending migrations in `supabase/migrations`.
4. Run `npm run dev`.

Without Supabase environment variables, the dashboard remains visible in setup mode and authentication calls remain disabled.

The shared development Supabase project is linked and currently has every committed migration applied. Do not commit `.env.local`, database passwords, access tokens, or service-role keys.

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Project status and handoff information live in `docs/PROJECT_STATE.md`.
