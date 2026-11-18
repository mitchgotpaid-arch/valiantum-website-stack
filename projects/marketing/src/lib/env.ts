import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function getPublicEnv(): PublicEnv {
  const environment = process.env;
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: environment.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!result.success) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }

  return result.data;
}

export function hasSupabaseEnv(): boolean {
  const environment = process.env;
  return publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: environment.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }).success;
}
