import "server-only";
import {cache} from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthenticationRequiredError";
  }
}

export const requireUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AuthenticationRequiredError();
  return { supabase, user };
});
