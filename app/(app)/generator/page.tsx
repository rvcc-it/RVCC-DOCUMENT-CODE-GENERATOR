import { getCompanySettings, requireSession } from "@/lib/auth";
import { GeneratorForm } from "./generator-form";

export const metadata = { title: "Generator | Unique Numbering Portal" };

export default async function GeneratorPage() {
  const { supabase, profile } = await requireSession();
  const [settings, depts, cats, originals, recent] = await Promise.all([
    getCompanySettings(),
    supabase.from("doc_code_gen_departments").select("id,department_name,department_code").eq("status", "active").order("department_name"),
    supabase.from("doc_code_gen_document_categories").select("id,category_name,category_code").eq("status", "active").order("category_name"),
    // Existing documents that can be revised. RLS: admins see all, everyone else only their own.
    supabase.from("doc_code_gen_generated_documents").select("id,document_code,document_title")
      .is("parent_document_id", null).neq("status", "cancelled").order("generated_at", { ascending: false }).limit(500),
    // The signed-in user's own latest codes (admins too: the full list lives on the History page).
    supabase.from("doc_code_gen_generated_documents")
      .select("id,document_code,document_title,generated_at,status,parent_document_id")
      .eq("applicant_id", profile.id).order("generated_at", { ascending: false }).limit(6),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="pop-in">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Document Code Generator</p>
        <h1 className="mt-1 text-3xl font-extrabold text-brand-900">Generate a document code</h1>
        <p className="mt-1 text-muted-foreground">Fill in the details and receive a unique, system-issued reference number.</p>
      </div>
      <GeneratorForm
        settings={settings}
        profile={{ name: profile.full_name, employeeId: profile.employee_id ?? "", departmentId: profile.department_id }}
        departments={depts.data ?? []}
        categories={cats.data ?? []}
        originals={originals.data ?? []}
        recent={recent.data ?? []}
        isAdmin={profile.role === "admin"}
      />
    </div>
  );
}
