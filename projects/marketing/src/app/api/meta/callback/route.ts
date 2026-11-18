import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AuthenticationRequiredError } from "@/data/auth";
import { canAdminPublishingBrand, saveMetaConnection } from "@/data/publishing";
import { getMetaEnvironment } from "@/lib/publishing/config";
import { encryptProviderCredential } from "@/lib/publishing/credential-crypto";
import { discoverMetaPage, exchangeMetaCode, MetaClientError } from "@/lib/publishing/meta-client";
import { metaOAuthCookieName } from "@/lib/publishing/meta-oauth";

const oauthCookieSchema = z.object({
  brandId: z.uuid(),
  state: z.string().min(32).max(128),
  issuedAt: z.number().int().positive(),
});

export async function GET(request: NextRequest) {
  const env = getMetaEnvironment();
  const stored = parseOAuthCookie(request.cookies.get(metaOAuthCookieName)?.value);
  if (!stored) return finish(env.NEXT_PUBLIC_APP_URL, null, "invalid_state");

  if (request.nextUrl.searchParams.has("error")) return finish(env.NEXT_PUBLIC_APP_URL, stored.brandId, "cancelled");
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  if (!state || !code || !safeEqual(state, stored.state) || Date.now() - stored.issuedAt > 600_000) {
    return finish(env.NEXT_PUBLIC_APP_URL, stored.brandId, "invalid_state");
  }

  try {
    if (!await canAdminPublishingBrand(stored.brandId)) return finish(env.NEXT_PUBLIC_APP_URL, stored.brandId, "not_permitted");
    const redirectUri = new URL("/marketing/api/meta/callback", env.NEXT_PUBLIC_APP_URL).toString();
    const token = await exchangeMetaCode(code, redirectUri, env);
    const page = await discoverMetaPage(token.access_token, env);
    const expiresAt = token.expires_in && token.expires_in > 0 ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;
    const credentialContext = `brand:${stored.brandId}:provider:META`;
    const encryptedCredential = encryptProviderCredential({
      systemAccessToken: token.access_token,
      pageAccessToken: page.access_token ?? token.access_token,
      facebookPageId: page.id,
      instagramAccountId: page.instagram_business_account?.id ?? null,
    }, env.META_APP_SECRET, credentialContext);

    await saveMetaConnection({
      brandId: stored.brandId,
      facebookPageId: page.id,
      facebookPageName: page.name,
      instagramAccountId: page.instagram_business_account?.id ?? null,
      instagramAccountName: page.instagram_business_account?.username ?? null,
      encryptedCredential,
      expiresAt,
    });
    return finish(env.NEXT_PUBLIC_APP_URL, stored.brandId, page.instagram_business_account ? "connected" : "instagram_missing");
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.redirect(new URL("/marketing/login", env.NEXT_PUBLIC_APP_URL));
    const code = error instanceof MetaClientError ? error.code.toLowerCase() : "failed";
    console.error("[meta] connection callback failed", { error: error instanceof Error ? error.name : "unknown", code });
    return finish(env.NEXT_PUBLIC_APP_URL, stored.brandId, code);
  }
}

function parseOAuthCookie(value: string | undefined): z.infer<typeof oauthCookieSchema> | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const parsed = oauthCookieSchema.safeParse(decoded);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function safeEqual(received: string, expected: string): boolean {
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
}

function finish(appUrl: string, brandId: string | null, outcome: string): NextResponse {
  const url = new URL("/marketing/settings", appUrl);
  if (brandId) url.searchParams.set("brand", brandId);
  url.searchParams.set("meta", outcome);
  const response = NextResponse.redirect(url);
  response.cookies.delete(metaOAuthCookieName);
  return response;
}
