import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { getCompanySettings, requireSession } from "@/lib/auth";
import { buildQuery, PAGE_SIZE, parseFilters } from "@/lib/history-query";
import type { DocumentRow } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { RowActions } from "./row-actions";

export const metadata = { title: "History | Unique Numbering Portal" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, profile } = await requireSession();
  const sp = await searchParams;
  const f = parseFilters(sp);
  const page = f.page ?? 1;
  const seesAll = profile.role !== "employee";

  const [settings, depts, cats, res] = await Promise.all([
    getCompanySettings(),
    supabase.from("doc_code_gen_departments").select("id,department_name").order("department_name"),
    supabase.from("doc_code_gen_document_categories").select("id,category_name").order("category_name"),
    buildQuery(supabase, f).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
  ]);
  const rows = (res.data ?? []) as DocumentRow[];
  const total = res.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...over })) {
      const val = Array.isArray(v) ? v[0] : v;
      if (val !== undefined && val !== "") p.set(k, String(val));
    }
    return p.toString();
  };
  const sortLink = (col: string) => {
    const active = (f.sort ?? "generated_at") === col;
    const dir = active && f.dir !== "asc" ? "asc" : "desc";
    return { href: `/history?${qs({ sort: col, dir, page: 1 })}`, active, asc: f.dir === "asc" };
  };
  const Head = ({ col, children }: { col: string; children: React.ReactNode }) => {
    const s = sortLink(col);
    return (
      <TH>
        <Link href={s.href} className="inline-flex items-center gap-1 hover:text-foreground">
          {children}
          {s.active && (s.asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </Link>
      </TH>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-800">Document History</h1>
          <p className="text-sm text-muted-foreground">
            {seesAll ? "All generated document codes." : "Document codes you have generated."} {total} record{total === 1 ? "" : "s"}.
          </p>
        </div>
        <a href={`/api/export?${qs({ page: undefined })}`}>
          <Button variant="outline"><Download className="h-4 w-4" /> Export CSV / Excel</Button>
        </a>
      </div>

      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input name="q" defaultValue={f.q} placeholder="Search by document code or title…" className="pl-9" />
            </div>
            <Select name="department" defaultValue={f.department ?? ""}>
              <option value="">All departments</option>
              {depts.data?.map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}
            </Select>
            <Select name="category" defaultValue={f.category ?? ""}>
              <option value="">All categories</option>
              {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.category_name}</option>)}
            </Select>
            {seesAll && <Input name="applicant" defaultValue={f.applicant} placeholder="Applicant name" />}
            <Select name="revision" defaultValue={f.revision ?? ""}>
              <option value="">All revisions</option>
              <option value="original">Original only (00)</option>
              <option value="revised">Revisions only</option>
            </Select>
            <Select name="status" defaultValue={f.status ?? ""}>
              <option value="">All statuses</option>
              <option value="active">Active</option><option value="revised">Revised</option><option value="cancelled">Cancelled</option>
            </Select>
            <div className="flex items-center gap-2">
              <Input type="date" name="from" defaultValue={f.from} aria-label="From date" />
              <Input type="date" name="to" defaultValue={f.to} aria-label="To date" />
            </div>
            <input type="hidden" name="sort" value={f.sort ?? ""} /><input type="hidden" name="dir" value={f.dir ?? ""} />
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit">Apply filters</Button>
              <Link href="/history"><Button type="button" variant="ghost">Reset</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <Head col="document_code">Document Code</Head>
              <Head col="document_title">Title</Head>
              <Head col="applicant_name">Applicant</Head>
              <TH>Department</TH><TH>Category</TH><TH>Recipient</TH>
              <Head col="revision_number">Rev</Head>
              <Head col="generated_at">Generated</Head>
              <Head col="status">Status</Head>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <TR><TD colSpan={10} className="py-12 text-center text-muted-foreground">No documents match your filters.</TD></TR>
            )}
            {rows.map((d) => (
              <TR key={d.id}>
                <TD className="font-mono font-semibold text-primary">
                  <Link href={`/history/${d.id}`} className="hover:underline">{d.document_code}</Link>
                </TD>
                <TD className="max-w-[240px] truncate" title={d.document_title}>{d.document_title}</TD>
                <TD>{d.applicant_name}</TD>
                <TD>{d.departments?.department_name}</TD>
                <TD>{d.document_categories?.category_name}</TD>
                <TD>{d.recipient_name ?? "—"}</TD>
                <TD className="font-mono">{String(d.revision_number).padStart(settings.revision_format, "0")}</TD>
                <TD className="whitespace-nowrap">{formatDateTime(d.generated_at)}</TD>
                <TD><StatusBadge status={d.status} /></TD>
                <TD className="text-right">
                  <RowActions id={d.id} company={settings.company_name} revisionDigits={settings.revision_format}
                    doc={{
                      code: d.document_code, title: d.document_title, description: d.document_description,
                      applicant: d.applicant_name, employeeId: d.employee_id, department: d.departments?.department_name ?? "",
                      category: d.document_categories?.category_name ?? "", recipient: d.recipient_name,
                      recipientOrg: d.recipient_organization, recipientEmail: d.recipient_email,
                      status: d.status, remarks: d.remarks, generatedAt: formatDateTime(d.generated_at),
                      revisionNumber: d.revision_number,
                    }} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 ? <Link href={`/history?${qs({ page: page - 1 })}`}><Button variant="outline" size="sm"><ChevronLeft className="h-4 w-4" />Prev</Button></Link>
              : <Button variant="outline" size="sm" disabled><ChevronLeft className="h-4 w-4" />Prev</Button>}
            {page < pages ? <Link href={`/history?${qs({ page: page + 1 })}`}><Button variant="outline" size="sm">Next<ChevronRight className="h-4 w-4" /></Button></Link>
              : <Button variant="outline" size="sm" disabled>Next<ChevronRight className="h-4 w-4" /></Button>}
          </div>
        </div>
      </Card>
    </div>
  );
}
