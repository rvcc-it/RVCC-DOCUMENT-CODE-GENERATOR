import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCompanySettings, requireSession } from "@/lib/auth";
import { SELECT } from "@/lib/history-query";
import type { DocumentRow } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { CodeBreakdown } from "@/components/code-breakdown";
import { codeParts } from "@/lib/numbering";
import { formatDateTime } from "@/lib/utils";
import { RowActions } from "../row-actions";
import { CancelButton } from "./cancel-button";

function Item({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value || "—"}</dd>
    </div>
  );
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireSession();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  // RLS: employees only receive their own rows.
  const { data } = await supabase.from("doc_code_gen_generated_documents").select(SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();
  const d = data as DocumentRow;
  if (profile.role !== "admin" && d.applicant_id !== profile.id) notFound(); // RLS enforces this too
  const settings = await getCompanySettings();
  const rootId = d.parent_document_id ?? d.id;

  const [{ data: chain }, { data: revisions }, audit] = await Promise.all([
    supabase.from("doc_code_gen_generated_documents").select("id,document_code,revision_number,status,generated_at,applicant_name")
      .or(`id.eq.${rootId},parent_document_id.eq.${rootId}`).order("revision_number"),
    supabase.from("doc_code_gen_document_revisions").select("revision_number,document_code,revision_notes,created_at").eq("document_id", rootId).order("revision_number"),
    profile.role === "admin"
      ? supabase.from("doc_code_gen_audit_logs").select("id,action,user_id,created_at").eq("table_name", "doc_code_gen_generated_documents").eq("record_id", id).order("created_at")
      : Promise.resolve({ data: null }),
  ]);
  const notes = new Map(revisions?.map((r) => [r.revision_number, r.revision_notes]));
  const catLen = settings.sequence_length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/history" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to history
      </Link>

      <Card className="border-2 border-primary/30 bg-blue-50/60">
        <CardContent className="space-y-4 p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Document Code</p>
          <h1 className="break-all font-mono text-3xl font-extrabold text-primary sm:text-4xl">{d.document_code}</h1>
          <StatusBadge status={d.status} />
          <CodeBreakdown parts={codeParts(d, settings, d.departments?.department_code ?? "", d.document_categories?.category_code ?? "",
            Math.max(catLen, String(d.sequence_number).length))} />
          <RowActions id={d.id} company={settings.company_name} revisionDigits={settings.revision_format}
            doc={{
              code: d.document_code, title: d.document_title, description: d.document_description, applicant: d.applicant_name,
              employeeId: d.employee_id, department: d.departments?.department_name ?? "", category: d.document_categories?.category_name ?? "",
              recipient: d.recipient_name, recipientOrg: d.recipient_organization, recipientEmail: d.recipient_email,
              status: d.status, remarks: d.remarks, generatedAt: formatDateTime(d.generated_at), revisionNumber: d.revision_number,
            }} />
          {profile.role === "admin" && d.status !== "cancelled" && <CancelButton id={d.id} />}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Document</CardTitle></CardHeader>
          <CardContent><dl className="grid gap-4">
            <Item label="Title" value={d.document_title} />
            <Item label="Description" value={d.document_description} />
            <Item label="Department" value={d.departments?.department_name} />
            <Item label="Category" value={d.document_categories?.category_name} />
            <Item label="Remarks" value={<span className="whitespace-pre-line">{d.remarks}</span>} />
            <Item label="Generated" value={formatDateTime(d.generated_at)} />
          </dl></CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Applicant</CardTitle></CardHeader>
            <CardContent><dl className="grid gap-4">
              <Item label="Name" value={d.applicant_name} /><Item label="Employee ID" value={d.employee_id} />
            </dl></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Recipient</CardTitle></CardHeader>
            <CardContent><dl className="grid gap-4">
              <Item label="Name" value={d.recipient_name} /><Item label="Organization" value={d.recipient_organization} />
              <Item label="Email" value={d.recipient_email} />
            </dl></CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Revision history</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {chain?.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
              <div>
                <Link href={`/history/${r.id}`} className="font-mono font-semibold text-primary hover:underline">{r.document_code}</Link>
                {r.id === d.id && <span className="ml-2 text-xs text-muted-foreground">(this record)</span>}
                {notes.get(r.revision_number) && <p className="text-xs text-muted-foreground">{notes.get(r.revision_number)}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{formatDateTime(r.generated_at)} · {r.applicant_name}</span>
                <StatusBadge status={r.status} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {audit.data && (
        <Card>
          <CardHeader><CardTitle>Audit information</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {audit.data.map((a) => (
              <p key={a.id}><span className="font-mono font-semibold">{a.action}</span> · {formatDateTime(a.created_at)} · user {a.user_id?.slice(0, 8)}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
