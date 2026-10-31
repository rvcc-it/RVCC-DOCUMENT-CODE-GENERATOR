import { getCompanySettings, requireSession } from "@/lib/auth";
import { GeneratorForm } from "./generator-form";

export const metadata = { title: "Generator | Unique Numbering Portal" };

export default async function GeneratorPage() {
  const { supabase, profile } = await requireSession();
  const [settings, depts, cats, originals] = await Promise.all([
    getCompanySettings(),
    supabase.from("doc_code_gen_departments").select("id,department_name,department_code").eq("status", "active").order("department_name"),
    supabase.from("doc_code_gen_document_categories").select("id,category_name,category_code").eq("status", "active").order("category_name"),
    // Chain roots the user may revise (RLS limits employees to their own).
    supabase.from("doc_code_gen_generated_documents").select("id,document_code,document_title")
      .is("parent_document_id", null).neq("status", "cancelled").order("generated_at", { ascending: false }).limit(300),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">Generate Document Code</h1>
        <p className="text-sm text-muted-foreground">Complete the form to receive a unique, system-issued reference number.</p>
      </div>
      <GeneratorForm
        settings={settings}
        profile={{ name: profile.full_name, employeeId: profile.employee_id ?? "", departmentId: profile.department_id }}
        departments={depts.data ?? []}
        categories={cats.data ?? []}
        originals={originals.data ?? []}
      />
    </div>
  );
}
