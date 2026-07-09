import { loginWithSupabaseToken } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Supabase redirects here after the Google OAuth round trip. We exchange the
 * auth code for a Supabase session, then hand the resulting access token to
 * apps/api so it (not the browser) is the one that verifies the token and
 * upserts the domain User — see lib/api.ts and .claude/plan1.md §3.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    await loginWithSupabaseToken(data.session.access_token);
  } catch {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login`);
  }

  return NextResponse.redirect(`${origin}/`);
}
