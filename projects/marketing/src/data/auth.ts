import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthenticationRequiredError";
  }
}

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AuthenticationRequiredError();
  return { supabase, user };
}
