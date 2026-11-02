import type { SupabaseClient } from "@supabase/supabase-js";

export interface HistoryFilters {
  q?: string; department?: string; category?: string; applicant?: string;
  from?: string; to?: string; revision?: string; status?: string;
  sort?: string; dir?: string; page?: number;
}

export const PAGE_SIZE = 15;
export const SORTABLE = ["document_code", "document_title", "applicant_name", "revision_number", "generated_at", "status"] as const;

export const SELECT =
  "*, departments:doc_code_gen_departments(department_name,department_code), document_categories:doc_code_gen_document_categories(category_name,category_code)";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Remove characters that carry meaning in PostgREST or LIKE filter syntax. */
const clean = (s: string) => s.replace(/[,()*%\\_"']/g, " ").trim().slice(0, 100);

export function parseFilters(sp: Record<string, string | string[] | undefined>): HistoryFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) || undefined;
  return {
    q: one("q"), department: one("department"), category: one("category"), applicant: one("applicant"),
    from: one("from"), to: one("to"), revision: one("revision"), status: one("status"),
    sort: one("sort"), dir: one("dir"), page: Math.max(1, Number(one("page")) || 1),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyFilters(query: any, f: HistoryFilters) {
  if (f.q && clean(f.q)) {
    const q = clean(f.q);
    query = query.or(`document_code.ilike.%${q}%,document_title.ilike.%${q}%`);
  }
  if (f.department && UUID.test(f.department)) query = query.eq("department_id", f.department);
  if (f.category && UUID.test(f.category)) query = query.eq("category_id", f.category);
  if (f.applicant && clean(f.applicant)) query = query.ilike("applicant_name", `%${clean(f.applicant)}%`);
  if (f.from && DATE.test(f.from)) query = query.gte("generated_at", f.from);
  if (f.to && DATE.test(f.to)) query = query.lt("generated_at", new Date(new Date(f.to).getTime() + 86400000).toISOString());
  if (f.revision === "original") query = query.eq("revision_number", 0);
  else if (f.revision === "revised") query = query.gt("revision_number", 0);
  if (f.status && ["active", "revised", "cancelled"].includes(f.status)) query = query.eq("status", f.status);
  const sort = (SORTABLE as readonly string[]).includes(f.sort ?? "") ? f.sort! : "generated_at";
  return query.order(sort, { ascending: f.dir === "asc" });
}

/** ownerId: restrict to one user's records (everyone except admins). RLS enforces the same rule in the database. */
export function buildQuery(supabase: SupabaseClient, f: HistoryFilters, ownerId?: string) {
  let q = supabase.from("doc_code_gen_generated_documents").select(SELECT, { count: "exact" });
  if (ownerId) q = q.eq("applicant_id", ownerId);
  return applyFilters(q, f);
}
