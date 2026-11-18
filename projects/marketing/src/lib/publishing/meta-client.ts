import "server-only";
import { z } from "zod";
import type { MetaEnvironment } from "./config";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().int().nonnegative().optional(),
});

const pageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  access_token: z.string().min(1).optional(),
  instagram_business_account: z.object({
    id: z.string().min(1),
    username: z.string().min(1).optional(),
  }).optional(),
});

const pagesResponseSchema = z.object({ data: z.array(pageSchema) });

export type MetaToken = z.infer<typeof tokenResponseSchema>;
export type MetaPage = z.infer<typeof pageSchema>;

export class MetaClientError extends Error {
  constructor(public readonly code: "TOKEN_EXCHANGE_FAILED" | "ACCOUNT_DISCOVERY_FAILED" | "NO_PAGE" | "MULTIPLE_PAGES") {
    super(code);
    this.name = "MetaClientError";
  }
}

export async function exchangeMetaCode(code: string, redirectUri: string, env: MetaEnvironment): Promise<MetaToken> {
  const response = await fetch(`https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/oauth/access_token`, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.META_APP_ID,
      client_secret: env.META_APP_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!response.ok) throw new MetaClientError("TOKEN_EXCHANGE_FAILED");
  const parsed = tokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new MetaClientError("TOKEN_EXCHANGE_FAILED");
  return parsed.data;
}

export async function discoverMetaPages(accessToken: string, env: MetaEnvironment): Promise<MetaPage[]> {
  const fields = "id,name,access_token,instagram_business_account{id,username}";
  const response = await fetch(`https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/me/accounts?limit=100&fields=${encodeURIComponent(fields)}`, {
    cache: "no-store",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new MetaClientError("ACCOUNT_DISCOVERY_FAILED");
  const parsed = pagesResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new MetaClientError("ACCOUNT_DISCOVERY_FAILED");
  if (!parsed.data.data.length) throw new MetaClientError("NO_PAGE");
  return parsed.data.data;
}

export async function discoverMetaPage(accessToken:string,env:MetaEnvironment):Promise<MetaPage>{const pages=await discoverMetaPages(accessToken,env);if(pages.length!==1)throw new MetaClientError("MULTIPLE_PAGES");return pages[0];}
