import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AuthenticationRequiredError } from "@/data/auth";
import { canAdminPublishingBrand } from "@/data/publishing";
import { getMetaEnvironment } from "@/lib/publishing/config";
import { metaOAuthCookieName } from "@/lib/publishing/meta-oauth";

const brandIdSchema = z.uuid();

export async function GET(request: NextRequest) {
  const env = getMetaEnvironment();
  const parsedBrandId = brandIdSchema.safeParse(request.nextUrl.searchParams.get("brandId"));
  if (!parsedBrandId.success) return new Response("Invalid Brand.", { status: 400 });

  try {
    if (!await canAdminPublishingBrand(parsedBrandId.data)) return new Response("Not permitted.", { status: 403 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.redirect(new URL("/marketing/login", env.NEXT_PUBLIC_APP_URL));
    throw error;
  }

  const state = randomBytes(32).toString("base64url");
  const redirectUri = new URL("/marketing/api/meta/callback", env.NEXT_PUBLIC_APP_URL).toString();
  const authorizationUrl = new URL(`https://www.facebook.com/${env.META_GRAPH_API_VERSION}/dialog/oauth`);
  authorizationUrl.search = new URLSearchParams({
    client_id: env.META_APP_ID,
    config_id: env.META_LOGIN_CONFIG_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    override_default_response_type: "true",
    state,
  }).toString();

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(metaOAuthCookieName, encodeOAuthCookie({ brandId: parsedBrandId.data, state, issuedAt: Date.now() }), {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(env.NEXT_PUBLIC_APP_URL).protocol === "https:",
    path: "/marketing/api/meta",
    maxAge: 600,
  });
  return response;
}

function encodeOAuthCookie(value: { brandId: string; state: string; issuedAt: number }): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
