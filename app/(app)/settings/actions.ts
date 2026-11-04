"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

async function guard() {
  const s = await getSession();
  return s && s.profile.role === "admin" ? s : null;
}
const DENIED = fail("Administrator access required.");
const pgMessage = (e: { message: string; code?: string }) =>
  e.code === "23505" ? "That name or code is already in use." : e.message;

// ---------- numbering / company ----------
const REQUIRED_TOKENS = ["{COMPANY}", "{DEPT}", "{CAT}", "{SEQ}", "{REV}"];

const settingsSchema = z.object({
  company_name: z.string().trim().min(1).max(120),
  company_code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,10}$/, "Company code: 1-10 letters/digits"),
  company_logo_url: z.union([z.literal(""), z.url()]).transform((v) => v || null),
  current_year: z.union([z.literal(""), z.coerce.number().int().min(2000).max(2100)]).transform((v) => (v === "" ? null : v)),
  year_format: z.enum(["YY", "YYYY"]),
  sequence_length: z.coerce.number().int().min(1).max(8),
  revision_format: z.coerce.number().int().min(1).max(4),
  default_revision: z.coerce.number().int().min(0).max(99),
  separator: z.string().max(2),
  sequence_reset: z.enum(["yearly", "never"]),
  numbering_format: z.string().trim().max(120)
    .regex(/^(\{[A-Z]+\}|[A-Za-z0-9\-_./ ])+$/, "Format may only contain tokens and letters, digits, - _ . / ")
    .superRefine((v, ctx) => {
      const unknown = (v.match(/\{[A-Z]+\}/g) ?? []).filter((t) => ![...REQUIRED_TOKENS, "{YEAR}", "{SEP}"].includes(t));
      if (unknown.length) ctx.addIssue({ code: "custom", message: `Unknown token ${unknown[0]}` });
      const missing = REQUIRED_TOKENS.find((t) => !v.includes(t));
      if (missing) ctx.addIssue({ code: "custom", message: `Format must contain ${missing} so codes stay unique` });
    }),
  smtp_provider: z.enum(["none", "resend", "smtp"]),
  notify_recipient: z.boolean(),
});

export async function saveSettings(patch: Record<string, unknown>): Promise<Result> {
  const s = await guard();
  if (!s) return DENIED;
  const parsed = settingsSchema.partial().safeParse(patch);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  if (parsed.data.numbering_format?.includes("{YEAR}") === false && (parsed.data.sequence_reset ?? "yearly") === "yearly")
    return fail("Yearly sequence reset requires {YEAR} in the format, otherwise codes would repeat each year.");
  const { error } = await s.supabase.from("doc_code_gen_company_settings").update(parsed.data).eq("id", 1);
  if (error) return fail(pgMessage(error));
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- departments & categories ----------
const code = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,6}$/, "Code: 1-6 letters/digits");
const deptSchema = z.object({ id: z.uuid().optional(), name: z.string().trim().min(1).max(100), code });
const catSchema = deptSchema.extend({ sequence_length: z.union([z.null(), z.coerce.number().int().min(1).max(8)]) });

export async function saveDepartment(input: z.input<typeof deptSchema>): Promise<Result> {
  const s = await guard();
  if (!s) return DENIED;
  const p = deptSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const row = { department_name: p.data.name, department_code: p.data.code };
  const { error } = p.data.id
    ? await s.supabase.from("doc_code_gen_departments").update(row).eq("id", p.data.id)
    : await s.supabase.from("doc_code_gen_departments").insert(row);
  if (error) return fail(pgMessage(error));
  revalidatePath("/settings");
  return { ok: true };
}

export async function saveCategory(input: z.input<typeof catSchema>): Promise<Result> {
  const s = await guard();
  if (!s) return DENIED;
  const p = catSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const row = { category_name: p.data.name, category_code: p.data.code, sequence_length: p.data.sequence_length };
  const { error } = p.data.id
    ? await s.supabase.from("doc_code_gen_document_categories").update(row).eq("id", p.data.id)
    : await s.supabase.from("doc_code_gen_document_categories").insert(row);
  if (error) return fail(pgMessage(error));
  revalidatePath("/settings");
  return { ok: true };
}

export async function setMasterStatus(table: "doc_code_gen_departments" | "doc_code_gen_document_categories", id: string, active: boolean): Promise<Result> {
  const s = await guard();
  if (!s) return DENIED;
  if (!z.uuid().safeParse(id).success || !["doc_code_gen_departments", "doc_code_gen_document_categories"].includes(table)) return fail("Invalid request");
  const { error } = await s.supabase.from(table).update({ status: active ? "active" : "inactive" }).eq("id", id);
  if (error) return fail(pgMessage(error));
  revalidatePath("/settings");
  return { ok: true };
}

// ---------- users (own table + bcrypt credentials; credentials need the server-only service role) ----------
const PASSWORD = z.string().min(5, "Password must be at least 5 characters").max(200);
const userBase = {
  full_name: z.string().trim().min(1).max(150),
  employee_id: z.string().trim().max(40).optional().default(""),
  department_id: z.union([z.literal(""), z.uuid()]).optional().default(""),
  role: z.enum(["admin", "management", "employee"]),
};
const createUserSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: PASSWORD, ...userBase });
const updateUserSchema = z.object({ id: z.uuid(), status: z.enum(["active", "inactive"]), ...userBase });

export async function createUser(input: z.input<typeof createUserSchema>): Promise<Result> {
  const s = await guard();
  if (!s) return DENIED;
  const p = createUserSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);

  // Insert as the admin so the audit trigger records who created the user.
  const { data: user, error } = await s.supabase.from("doc_code_gen_users").insert({
    full_name: p.data.full_name, email: p.data.email, role: p.data.role,
    employee_id: p.data.employee_id || null, department_id: p.data.department_id || null,
  }).select("id").single();
  if (error) return fail(pgMessage(error));

  const admin = createAdminClient();
  const { error: credError } = await admin.from("doc_code_gen_user_credentials")
    .insert({ user_id: user.id, password_hash: await bcrypt.hash(p.data.password, 10) });
  if (credError) {
    await admin.from("doc_code_gen_users").delete().eq("id", user.id); // no half-created accounts
    return fail(credError.message);
  }
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateUser(input: z.input<typeof updateUserSchema>): Promise<Result> {
  const s = await guard();
  if (!s) return DENIED;
  const p = updateUserSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  if (p.data.id === s.user.id && (p.data.role !== "admin" || p.data.status !== "active"))
    return fail("You cannot demote or deactivate your own account.");
  const { error } = await s.supabase.from("doc_code_gen_users").update({
    full_name: p.data.full_name, role: p.data.role, status: p.data.status,
    employee_id: p.data.employee_id || null, department_id: p.data.department_id || null,
  }).eq("id", p.data.id);
  if (error) return fail(pgMessage(error));
  if (p.data.status === "inactive") await revokeSessions(p.data.id);
  revalidatePath("/settings");
  return { ok: true };
}

export async function resetUserAccess(userId: string, newPassword: string): Promise<Result> {
  const s = await guard();
  if (!s) return DENIED;
  if (!z.uuid().safeParse(userId).success) return fail("Invalid user");
  const pw = PASSWORD.safeParse(newPassword);
  if (!pw.success) return fail(pw.error.issues[0].message);
  const admin = createAdminClient();
  const { data: cur } = await admin.from("doc_code_gen_user_credentials").select("session_version").eq("user_id", userId).maybeSingle();
  const { error } = await admin.from("doc_code_gen_user_credentials").upsert({
    user_id: userId, password_hash: await bcrypt.hash(pw.data, 10), session_version: (cur?.session_version ?? 0) + 1,
    updated_at: new Date().toISOString(),
  });
  if (error) return fail(error.message);
  await admin.from("doc_code_gen_audit_logs").insert({ user_id: s.user.id, action: "RESET_ACCESS", table_name: "doc_code_gen_users", record_id: userId });
  return { ok: true };
}

/** Bumping session_version invalidates every session cookie issued before. */
async function revokeSessions(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("doc_code_gen_user_credentials").select("session_version").eq("user_id", userId).maybeSingle();
  if (data) await admin.from("doc_code_gen_user_credentials").update({ session_version: data.session_version + 1 }).eq("user_id", userId);
}
