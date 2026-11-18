# TikTok Publishing Plan

## Product decision

Valiantum will integrate TikTok through the official Content Posting API. TikTok is modeled as `REVIEW_REQUIRED`, not fully automatic, because TikTok requires current creator information, user-selected privacy and interaction settings, and explicit consent before each Direct Post.

## Delivery stages

### 1. Draft upload

- Register a TikTok developer app and add Login Kit plus Content Posting API.
- Request `user.info.basic` and `video.upload`.
- Build OAuth with CSRF state validation and encrypted server-side storage for access and refresh tokens.
- Upload approved video or photo content into the creator's TikTok inbox for final editing and posting.
- Track the returned `publish_id` and webhook status.

### 2. Direct Post sandbox

- Request `video.publish`.
- Query creator info immediately before the export screen.
- Require the user to choose an allowed privacy level with no default.
- Respect creator-level comment, duet, stitch, and maximum-duration settings.
- Require the TikTok music-usage confirmation before publishing.
- Label AI-generated content when applicable.
- Keep all unaudited test posts private.

### 3. TikTok audit and production

- Deploy Valiantum on a public HTTPS domain.
- Publish accessible Privacy Policy and Terms of Service pages.
- Verify the media-hosting domain or URL prefix for pull-from-URL uploads.
- Record the complete OAuth and publishing flow for TikTok app review.
- Submit Login Kit, Content Posting API, and only the scopes Valiantum actually uses.

## Media rules to enforce

- Video: MP4 preferred, H.264 preferred, 23–60 FPS, 360–4096 pixels, and at most 4 GB.
- Photos: WebP or JPEG, at most 1080p and 20 MB each.
- Do not add Valiantum or third-party promotional watermarks to exported media.
- Store access and refresh tokens only in encrypted server-side credential storage.

## Official references

- https://developers.tiktok.com/docs/en/content-posting-api-get-started
- https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post
- https://developers.tiktok.com/docs/en/content-posting-api-reference-photo-post
- https://developers.tiktok.com/docs/en/login-kit-web
- https://developers.tiktok.com/docs/en/app-review-guidelines
- https://developers.tiktok.com/doc/content-sharing-guidelines
