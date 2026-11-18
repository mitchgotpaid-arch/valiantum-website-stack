import {authCookieOptions} from './cookie-options';
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv, getPublicEnv } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  if (!hasSupabaseEnv()) return NextResponse.next({ request });

  const env = getPublicEnv();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, authCookieOptions(options)));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const pathname=request.nextUrl.pathname.replace(/^\/marketing(?=\/|$)/,'')||'/';
  const isLogin=pathname.startsWith('/login');
  if(!user&&pathname.startsWith('/api/projects/'))return NextResponse.json({error:'Connect your Marketing OS account.',loginUrl:'/marketing/login'},{status:401});
  if (!user && !isLogin) {
    const url = new URL("/marketing/login", process.env.NEXT_PUBLIC_APP_URL || request.url);
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = new URL("/marketing", process.env.NEXT_PUBLIC_APP_URL || request.url);
    return NextResponse.redirect(url);
  }
  return response;
}
