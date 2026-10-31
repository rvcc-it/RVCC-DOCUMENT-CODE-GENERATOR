import "server-only";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { readSessionToken } from "@/lib/session";

/**
 * Supabase client acting as the signed-in user (RLS applies).
 * Pass a token to skip the cookie lookup.
 */
export async function createClient(token?: string) {
  const jwt = token ?? (await readSessionToken())?.token;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt ?? anon}` } },
  });
}
