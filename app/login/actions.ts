"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { clearSessionCookie, createSessionToken, setSessionCookie } from "@/lib/session";

const schema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email"), password: z.string().min(1, "Password is required") });

// Compared against when the email is unknown so response time does not reveal valid accounts.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// Per-instance brute-force throttle. Add Cloudflare rate limiting for a cross-instance guarantee.
const attempts = new Map<string, { n: number; until: number }>();
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function login(_: { error?: string } | undefined, formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password } = parsed.data;

  const a = attempts.get(email);
  if (a && a.until > Date.now() && a.n >= MAX_FAILS) return { error: "Too many attempts. Try again in 15 minutes." };

  const admin = createAdminClient();
  const { data: user } = await admin.from("doc_code_gen_users").select("id,status").eq("email", email).maybeSingle();
  const { data: cred } = user
    ? await admin.from("doc_code_gen_user_credentials").select("password_hash,session_version").eq("user_id", user.id).maybeSingle()
    : { data: null };

  const ok = await bcrypt.compare(password, cred?.password_hash ?? DUMMY_HASH);
  if (!user || !cred || !ok) {
    const cur = a && a.until > Date.now() ? a : { n: 0, until: Date.now() + WINDOW_MS };
    attempts.set(email, { n: cur.n + 1, until: cur.until });
    return { error: "Invalid email or password" };
  }
  if (user.status !== "active") return { error: "Your account is inactive. Contact an administrator." };

  attempts.delete(email);
  await setSessionCookie(await createSessionToken(user.id, cred.session_version));
  redirect("/generator");
}

export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}
