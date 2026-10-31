import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSessionToken } from "@/lib/session";
import type { CompanySettings, Profile, Role } from "@/lib/types";

/** Validates the session cookie against the database (user active, session not revoked). */
export const getSession = cache(async () => {
  const s = await readSessionToken();
  if (!s) return null;
  const admin = createAdminClient();
  const [{ data: profile }, { data: cred }] = await Promise.all([
    admin.from("doc_code_gen_users").select("*").eq("id", s.userId).maybeSingle(),
    admin.from("doc_code_gen_user_credentials").select("session_version").eq("user_id", s.userId).maybeSingle(),
  ]);
  if (!profile || profile.status !== "active" || !cred || cred.session_version !== s.version) return null;
  const supabase = await createClient(s.token);
  return { supabase, user: { id: s.userId }, profile: profile as Profile };
});

export async function requireSession(roles?: Role[]) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (roles && !roles.includes(session.profile.role)) redirect("/generator");
  return session;
}

export const getCompanySettings = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("doc_code_gen_company_settings").select("*").eq("id", 1).single();
  if (error || !data) {
    const hint = error?.code === "PGRST301"
      ? "SUPABASE_JWT_SECRET is wrong: use the legacy JWT secret (Project Settings > JWT Keys > Legacy JWT Secret), not a key ID."
      : error?.message ?? "settings row missing";
    throw new Error(`Could not load company settings: ${hint}`);
  }
  return data as CompanySettings;
});
