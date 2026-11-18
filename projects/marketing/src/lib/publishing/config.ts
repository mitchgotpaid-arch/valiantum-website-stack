import "server-only";
import { z } from "zod";

const metaEnvironmentSchema = z.object({
  META_APP_ID: z.string().min(1),
  META_APP_SECRET: z.string().min(1),
  META_GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/),
  META_LOGIN_CONFIG_ID: z.string().regex(/^\d+$/),
  NEXT_PUBLIC_APP_URL: z.url(),
});

export type MetaEnvironment = z.infer<typeof metaEnvironmentSchema>;

export function getMetaEnvironment(): MetaEnvironment {
  const result = metaEnvironmentSchema.safeParse(metaEnvironmentValues());
  if (!result.success) throw new Error("Meta publishing is not configured.");
  return result.data;
}

export function hasMetaEnvironment(): boolean {
  return metaEnvironmentSchema.safeParse(metaEnvironmentValues()).success;
}

function metaEnvironmentValues() {
  return {
    META_APP_ID: process.env.META_APP_ID,
    META_APP_SECRET: process.env.META_APP_SECRET,
    META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION,
    META_LOGIN_CONFIG_ID: process.env.META_LOGIN_CONFIG_ID,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  };
}
