"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };
const loginSchema = z.object({ email: z.email().max(320), password: z.string().min(8).max(1024) });

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  if (!hasSupabaseEnv()) return { error: "Supabase is not configured for this environment." };
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter a valid email address and a password of at least 8 characters." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "The email or password was not accepted." };
  redirect("/");
}
