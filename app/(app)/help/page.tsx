import { getCompanySettings, requireSession } from "@/lib/auth";
import { previewCode } from "@/lib/numbering";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Help | Unique Numbering Portal" };

export default async function HelpPage() {
  const { supabase } = await requireSession();
  const [s, depts, cats] = await Promise.all([
    getCompanySettings(),
    supabase.from("doc_code_gen_departments").select("department_name,department_code").eq("status", "active").order("department_name"),
    supabase.from("doc_code_gen_document_categories").select("category_name,category_code").eq("status", "active").order("category_name"),
  ]);
  const year = s.current_year ?? new Date().getFullYear();
  const d0 = depts.data?.[0]?.department_code ?? "O";
  const c0 = cats.data?.[0]?.category_code ?? "F";
  const ex = (seq: number, rev = 0, d = d0, c = c0) => previewCode(s, year, d, c, seq, rev);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-brand-800">Help</h1>

      <Card>
        <CardHeader><CardTitle>How to generate a document code</CardTitle></CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Open <b>Generator</b> from the menu.</li>
            <li>Check your name (pre-filled) and optionally add recipient details.</li>
            <li>Choose the <b>Department</b> and <b>Document Type</b>, then enter the document title.</li>
            <li>Tick <b>Is there a revision?</b> only when you are revising an existing document, and pick the original.</li>
            <li>Click <b>Generate Code</b>. The code is issued by the server; you can copy it, download a PDF or print it.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Numbering structure</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="rounded-lg bg-blue-50 p-4 text-center font-mono text-2xl font-bold text-primary">{ex(1)}</p>
          <Table>
            <THead><TR className="hover:bg-transparent"><TH>Part</TH><TH>Meaning</TH></TR></THead>
            <TBody>
              <TR><TD className="font-mono">{s.company_code}</TD><TD>Company code</TD></TR>
              <TR><TD className="font-mono">{s.year_format === "YYYY" ? year : String(year % 100).padStart(2, "0")}</TD><TD>Year ({s.year_format})</TD></TR>
              <TR><TD className="font-mono">{d0}</TD><TD>Department code</TD></TR>
              <TR><TD className="font-mono">{c0}</TD><TD>Document category code</TD></TR>
              <TR><TD className="font-mono">{String(1).padStart(s.sequence_length, "0")}</TD><TD>Sequence — counts separately per department and category, starting at 1</TD></TR>
              <TR><TD className="font-mono">{String(0).padStart(s.revision_format, "0")}</TD><TD>Revision — 00 for the original, 01, 02… for revisions</TD></TR>
            </TBody>
          </Table>
          <p>Examples: <span className="font-mono">{ex(1)}</span>, <span className="font-mono">{ex(2)}</span>, <span className="font-mono">{ex(2, 1)}</span> (first revision of #2).</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Department codes</CardTitle></CardHeader>
          <Table><TBody>{depts.data?.map((d) => <TR key={d.department_code}><TD>{d.department_name}</TD><TD className="font-mono font-semibold">{d.department_code}</TD></TR>)}</TBody></Table>
        </Card>
        <Card>
          <CardHeader><CardTitle>Document category codes</CardTitle></CardHeader>
          <Table><TBody>{cats.data?.map((c) => <TR key={c.category_code}><TD>{c.category_name}</TD><TD className="font-mono font-semibold">{c.category_code}</TD></TR>)}</TBody></Table>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Revisions, history and downloads</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><b>Revisions:</b> a revision keeps the original number and increments only the revision part. Earlier versions are marked <i>Revised</i> and remain on record.</p>
          <p><b>History:</b> open <b>History</b> to search, filter, sort and export your codes. Click a code to see its full details and revision chain.</p>
          <p><b>Copy / PDF / Print:</b> use the icons on each history row, or the buttons shown after generating a code.</p>
          <p>Codes cannot be edited or deleted. If a code was issued in error, ask an administrator to cancel it.</p>
        </CardContent>
      </Card>
    </div>
  );
}
