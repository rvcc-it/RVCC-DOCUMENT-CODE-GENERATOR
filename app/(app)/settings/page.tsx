import { getCompanySettings, requireSession } from "@/lib/auth";
import type { Category, Department, Profile } from "@/lib/types";
import { SettingsTabs } from "./settings-tabs";

export const metadata = { title: "Settings | Unique Numbering Portal" };

export default async function SettingsPage() {
  const { supabase, profile } = await requireSession(["admin"]);
  const [settings, depts, cats, users, counts, audit] = await Promise.all([
    getCompanySettings(),
    supabase.from("doc_code_gen_departments").select("*").order("department_name"),
    supabase.from("doc_code_gen_document_categories").select("*").order("category_name"),
    supabase.from("doc_code_gen_users").select("*").order("full_name"),
    supabase.from("doc_code_gen_department_counts").select("*"),
    supabase.from("doc_code_gen_audit_logs").select("id,user_id,action,table_name,record_id,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  const names = new Map((users.data ?? []).map((u) => [u.id, u.full_name || u.email]));

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">Settings</h1>
        <p className="text-sm text-muted-foreground">Company, numbering rules, master data, users and audit trail.</p>
      </div>
      <SettingsTabs
        settings={settings}
        departments={(depts.data ?? []) as Department[]}
        categories={(cats.data ?? []) as Category[]}
        users={(users.data ?? []) as Profile[]}
        counts={Object.fromEntries((counts.data ?? []).map((c) => [c.department_id, c.total]))}
        audit={(audit.data ?? []).map((a) => ({ ...a, id: String(a.id), user: a.user_id ? names.get(a.user_id) ?? a.user_id.slice(0, 8) : "system" }))}
        currentUserId={profile.id}
      />
    </div>
  );
}
