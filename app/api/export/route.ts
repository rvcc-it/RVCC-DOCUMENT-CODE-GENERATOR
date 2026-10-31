import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { applyFilters, parseFilters, SELECT } from "@/lib/history-query";
import type { DocumentRow } from "@/lib/types";

// Cells beginning with these characters can execute as formulas in Excel.
const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const sp = Object.fromEntries(req.nextUrl.searchParams);
  // RLS limits employees to their own rows regardless of filters.
  const { data, error } = await applyFilters(session.supabase.from("doc_code_gen_generated_documents").select(SELECT), parseFilters(sp)).limit(10000);
  if (error) return new NextResponse(error.message, { status: 500 });

  const head = ["Document Code", "Title", "Applicant", "Employee ID", "Department", "Category", "Recipient", "Organization",
    "Recipient Email", "Revision", "Status", "Generated At", "Remarks"];
  const rows = (data as DocumentRow[]).map((d) => [
    d.document_code, d.document_title, d.applicant_name, d.employee_id, d.departments?.department_name,
    d.document_categories?.category_name, d.recipient_name, d.recipient_organization, d.recipient_email,
    String(d.revision_number).padStart(2, "0"), d.status, d.generated_at, d.remarks,
  ]);
  const csv = "﻿" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="document-history-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
