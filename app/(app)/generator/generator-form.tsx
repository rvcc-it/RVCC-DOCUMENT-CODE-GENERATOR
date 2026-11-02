"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight, Building2, CheckCircle2, Copy, Download, FilePlus2, FileText, History, Printer, RefreshCw, Send, User } from "lucide-react";
import { generateCode, type GenerateResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/badge";
import { previewCode } from "@/lib/numbering";
import { downloadPdf, printPdf, type PdfDoc } from "@/lib/pdf";
import { formatDateTime } from "@/lib/utils";
import type { CompanySettings } from "@/lib/types";

interface Recent { id: string; document_code: string; document_title: string; generated_at: string; status: string; parent_document_id: string | null }
interface Props {
  settings: CompanySettings;
  profile: { name: string; employeeId: string; departmentId: string | null };
  departments: { id: string; department_name: string; department_code: string }[];
  categories: { id: string; category_name: string; category_code: string }[];
  originals: { id: string; document_code: string; document_title: string }[];
  recent: Recent[];
  isAdmin: boolean;
}

type Ok = Extract<GenerateResult, { ok: true }>;

function SectionTitle({ n, icon: Icon, title, hint }: { n: number; icon: typeof User; title: string; hint?: string }) {
  return (
    <CardHeader className="flex-row items-center gap-3">
      <span className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md shadow-blue-600/25"><Icon className="h-4 w-4" /></span>
      <div>
        <CardTitle>{n}. {title}</CardTitle>
        {hint && <CardDescription>{hint}</CardDescription>}
      </div>
    </CardHeader>
  );
}

export function GeneratorForm({ settings, profile, departments, categories, originals, recent, isAdmin }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isRevision, setIsRevision] = useState(false);
  const [parentId, setParentId] = useState("");
  const [result, setResult] = useState<Ok | null>(null);

  const year = settings.current_year ?? new Date().getFullYear();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "");
    start(async () => {
      const res = await generateCode({
        applicant_name: g("applicant_name"),
        recipient_name: g("recipient_name"),
        recipient_organization: g("recipient_organization"),
        recipient_email: g("recipient_email"),
        department_id: g("department_id"),
        category_id: g("category_id"),
        document_title: g("document_title"),
        document_description: g("document_description"),
        remarks: g("remarks"),
        is_revision: isRevision,
        parent_document_id: parentId,
        revision_notes: g("revision_notes"),
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setErrors({});
      setResult(res);
      toast.success(`Code generated: ${res.doc.document_code}`);
      if (res.emailed) toast.info("Recipient notified by email.");
      router.refresh();
      setTimeout(() => document.getElementById("result-panel")?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    });
  }

  function reset() {
    setResult(null);
    setIsRevision(false);
    setParentId("");
    setErrors({});
    formRef.current?.reset();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reviseExisting(r: Recent) {
    setIsRevision(true);
    setParentId(r.parent_document_id ?? r.id);
    setResult(null);
    toast.info(`Revising ${r.document_code}. Add the new title and generate.`);
    document.getElementById("revision-box")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="space-y-8">
      {result && <ResultPanel result={result} settings={settings} onReset={reset} />}

      <form ref={formRef} onSubmit={submit} className="space-y-6" noValidate>
        <Card>
          <SectionTitle n={1} icon={User} title="User information" hint="Filled in from your profile." />
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <Field label="Applicant's Full Name" required error={errors.applicant_name} className="sm:col-span-2">
              <Input name="applicant_name" defaultValue={profile.name} />
            </Field>
            <Field label="Employee ID"><Input value={profile.employeeId} readOnly disabled placeholder="Not assigned" /></Field>
            <Field label="Your Department">
              <Input value={departments.find((d) => d.id === profile.departmentId)?.department_name ?? "Not assigned"} readOnly disabled />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <SectionTitle n={2} icon={Send} title="Recipient" hint="Optional: who this document is going to." />
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <Field label="To Whom We Send"><Input name="recipient_name" /></Field>
            <Field label="Recipient Organization"><Input name="recipient_organization" /></Field>
            <Field label="Recipient Email" error={errors.recipient_email} className="sm:col-span-2"><Input name="recipient_email" type="email" /></Field>
          </CardContent>
        </Card>

        <Card>
          <SectionTitle n={3} icon={Building2} title="Document details" />
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <Field label="Department" required error={errors.department_id}>
              <Select name="department_id" defaultValue={profile.departmentId ?? ""} disabled={isRevision}>
                <option value="">Select department…</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.department_name} ({d.department_code})</option>)}
              </Select>
            </Field>
            <Field label="Document Type / Category" required error={errors.category_id}>
              <Select name="category_id" defaultValue="" disabled={isRevision}>
                <option value="">Select document type…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.category_name} ({c.category_code})</option>)}
              </Select>
            </Field>
            <Field label="Document Title / Subject" required error={errors.document_title} className="sm:col-span-2">
              <Input name="document_title" maxLength={250} />
            </Field>
            <Field label="Document Description" className="sm:col-span-2"><Textarea name="document_description" /></Field>

            <div id="revision-box" className={`space-y-4 rounded-xl border p-4 transition-colors sm:col-span-2 ${isRevision ? "border-primary/40 bg-blue-50" : "bg-muted/60"}`}>
              <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={isRevision}
                  onChange={(e) => { setIsRevision(e.target.checked); if (!e.target.checked) setParentId(""); }} />
                <RefreshCw className="h-4 w-4 text-primary" /> Is there a revision? <span className="font-normal text-muted-foreground">(select an existing document)</span>
              </label>
              {isRevision ? (
                <div className="grid gap-4">
                  <Field label="Existing document to revise" required error={errors.parent_document_id}
                    hint={originals.length ? "Department and category are taken from the original. The revision number goes up by one." : "No existing documents yet."}>
                    <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
                      <option value="">Select existing document…</option>
                      {originals.map((o) => <option key={o.id} value={o.id}>{o.document_code} — {o.document_title}</option>)}
                    </Select>
                  </Field>
                  <Field label="Revision notes"><Textarea name="revision_notes" /></Field>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Unchecked: a new code is issued with revision {String(settings.default_revision).padStart(settings.revision_format, "0")}. Example format:{" "}
                  <span className="font-mono font-semibold text-primary">{previewCode(settings, year)}</span>
                </p>
              )}
            </div>
            <Field label="Remarks" className="sm:col-span-2"><Textarea name="remarks" /></Field>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" loading={pending} className="brand-gradient h-14 w-full text-base shadow-lg shadow-blue-600/30 transition hover:scale-[1.01] hover:brightness-110">
          <FilePlus2 className="h-5 w-5" /> Generate Code
        </Button>
      </form>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary"><History className="h-4 w-4" /></span>
            <div>
              <CardTitle>Your recent codes</CardTitle>
              <CardDescription>Copy a code or start a revision of an existing document.</CardDescription>
            </div>
          </div>
          <Link href="/history" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {isAdmin ? "All history" : "Full history"} <ArrowRight className="h-4 w-4" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No codes yet. Your first one will appear here.</p>
          ) : (
            <ul className="divide-y">
              {recent.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 transition hover:bg-blue-50/50">
                  <div className="min-w-0">
                    <Link href={`/history/${r.id}`} className="font-mono text-sm font-bold text-primary hover:underline">{r.document_code}</Link>
                    <p className="truncate text-sm text-muted-foreground">{r.document_title} · {formatDateTime(r.generated_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.status} />
                    <Button variant="ghost" size="icon" aria-label="Copy code" onClick={async () => {
                      try { await navigator.clipboard.writeText(r.document_code); toast.success("Copied " + r.document_code); } catch { toast.error("Copy failed"); }
                    }}><Copy className="h-4 w-4" /></Button>
                    {r.status !== "cancelled" && (
                      <Button variant="outline" size="sm" onClick={() => reviseExisting(r)}><RefreshCw className="h-3.5 w-3.5" /> Revise</Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Shows only the generated code and its actions. */
function ResultPanel({ result, settings, onReset }: { result: Ok; settings: CompanySettings; onReset: () => void }) {
  const { doc } = result;
  const pdfDoc: PdfDoc = {
    code: doc.document_code, title: doc.document_title, description: doc.document_description,
    applicant: doc.applicant_name, employeeId: doc.employee_id, department: result.department.name,
    category: result.category.name, recipient: doc.recipient_name, recipientOrg: doc.recipient_organization,
    recipientEmail: doc.recipient_email, revision: String(doc.revision_number).padStart(settings.revision_format, "0"),
    status: doc.status, generatedAt: formatDateTime(doc.generated_at), remarks: doc.remarks, company: settings.company_name,
  };
  return (
    <div id="result-panel" className="pop-in relative overflow-hidden rounded-3xl border border-primary/20 bg-white p-8 text-center shadow-[0_20px_60px_rgba(30,64,175,.18)] sm:p-12">
      <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-blue-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-sky-200/50 blur-3xl" />
      <div className="relative space-y-6">
        <p className="inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-1.5 text-sm font-semibold text-success ring-1 ring-green-200">
          <CheckCircle2 className="h-4 w-4" /> Code generated successfully
        </p>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">Final unique code</p>
          <h2 className="code-shine mt-3 break-all font-mono text-4xl font-extrabold sm:text-6xl" data-testid="final-code">{doc.document_code}</h2>
        </div>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Button variant="outline" size="lg" onClick={async () => {
            try { await navigator.clipboard.writeText(doc.document_code); toast.success("Copied to clipboard"); }
            catch { toast.error("Copy failed - select the code manually"); }
          }}><Copy className="h-4 w-4" /> Copy Code</Button>
          <Button variant="outline" size="lg" onClick={() => downloadPdf(pdfDoc)}><Download className="h-4 w-4" /> Download PDF</Button>
          <Button variant="outline" size="lg" onClick={() => printPdf(pdfDoc)}><Printer className="h-4 w-4" /> Print</Button>
          <Button size="lg" onClick={onReset}><FileText className="h-4 w-4" /> Generate Another</Button>
        </div>
      </div>
    </div>
  );
}
