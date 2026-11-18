# Direct social account connections

The Connections hub (`/marketing/connections`) manages accounts by brand, without a managed publishing subscription. It covers Facebook, Instagram, X, TikTok, Pinterest, LinkedIn member profiles, YouTube, Threads, Reddit, Mastodon, and bsky.social-hosted Bluesky accounts.

## What is implemented

Each OAuth adapter uses the provider's authorization, server-side token exchange, and authenticated account discovery. Users explicitly confirm the destination account and brand before credentials are saved. Facebook Pages now have an account picker, including linked professional Instagram accounts. Bluesky exchanges a dedicated app password for session tokens; the password is never stored.

Tokens are AES-256-GCM encrypted with brand/provider associated data and kept in a private database table. Brand members can read connection metadata; only brand administrators can save/read encrypted credentials, check, or disconnect connections. RPCs enforce these rules independently of the UI. Refresh operations use optimistic concurrency checks, including rotated refresh tokens. Transient provider outages do not mark a valid connection revoked.

Pending authorization credentials stay in server memory for at most ten minutes, bound to the signed-in owner. A periodic purge removes expired entries. The current single-process Hostinger deployment supports this; a distributed deployment would need shared, encrypted pending storage. Restarting the server invalidates unfinished account selections and requires reconnecting.

Connection checks refresh expiring tokens and verify the same external account. LinkedIn may require renewed authorization when no refresh token is available. Mastodon tokens are bound to the configured server. Disconnect removes Valiantum's credentials, but users must separately revoke the grant in provider settings.

## One-time provider setup

The hub shows exact HTTPS callback URLs, required server environment variable names, permissions, and links to each provider's developer portal. Register those callback URLs verbatim. Secrets belong only in Hostinger's server environment, never GitHub, brand knowledge, or chat.

- Existing Meta: `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_API_VERSION`, `META_LOGIN_CONFIG_ID`.
- X: `X_CLIENT_ID`, `X_CLIENT_SECRET` (confidential web client).
- TikTok: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`.
- Pinterest: `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET`.
- LinkedIn: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`.
- YouTube: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`.
- Threads: `THREADS_APP_ID`, `THREADS_APP_SECRET` (Threads-specific credentials).
- Reddit: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`.
- Mastodon: `MASTODON_CLIENT_ID`, `MASTODON_CLIENT_SECRET`, `MASTODON_BASE_URL` (HTTPS server origin).
- Bluesky: no developer app credentials; enter a dedicated app password in the authenticated form.

`SOCIAL_CONNECTION_SECRET` is optional when the existing Meta secret is available. Changing either encryption root without re-encryption requires reconnecting affected accounts. `NEXT_PUBLIC_APP_URL` must be the canonical HTTPS origin.

Apply `supabase/migrations/20261118060000_direct_social_connections.sql` before using non-Meta connections. It preserves review requirements and publishing controls. No existing content or credentials are deleted.

## Limits and next steps

Provider app approval, user consent, eligible accounts and API access remain necessary. X may charge for API usage; other provider quotas or commercial terms can apply. This implementation does not buy credits or accept provider contracts.

Connections and channel-specific drafts are implemented. Generic media upload, live publishing adapters and an automated scheduling worker are not enabled by this change. TikTok requests `video.upload` for a future finish-in-TikTok draft workflow, not `video.publish`. LinkedIn Company Pages need a separate organization adapter and provider approval. Custom Bluesky PDS servers are not supported. Facebook discovery currently reads the first 100 Pages; YouTube the first 50 channels.

## Validation

Mock-provider tests cover eight OAuth identity shapes, PKCE, state tampering/expiry/owner boundaries, refresh rotation, revoked versus unavailable providers, Mastodon server binding, Bluesky password handling, and single-claim pending selections. Full-chain PostgreSQL tests exercise administrator/member/tenant boundaries, private-token access denial, concurrency rejection, token deletion, and channel draft review defaults. Production runtime tests verify private page redirects and CSP nonces. Actual provider consent and posting are not simulated as successful connections.
