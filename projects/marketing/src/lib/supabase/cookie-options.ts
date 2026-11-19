// Marketing uses server-side Supabase clients exclusively. Tokens need not be
// readable by browser JavaScript. Keep the existing path to avoid duplicate cookies.
export function authCookieOptions(options: Record<string, unknown>) {
  return {...options, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/'};
}
