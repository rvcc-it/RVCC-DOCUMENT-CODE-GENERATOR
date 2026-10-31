"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Copy, Download, FilePlus2, Printer } from "lucide-react";
import { generateCode, type GenerateResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { CodeBreakdown } from "@/components/code-breakdown";
import { codeParts, previewCode } from "@/lib/numbering";
import { downloadPdf, printPdf, type PdfDoc } from "@/lib/pdf";
import { formatDateTime } from "@/lib/utils";
import type { CompanySettings } from "@/lib/types";

interface Props {
  settings: CompanySettings;
  profile: { name: string; employeeId: string; departmentId: string | null };
  departments: { id: string; department_name: string; department_code: string }[];
  categories: { id: string; category_name: string; category_code: string }[];
  originals: { id: string; document_code: string; document_title: string }[];
}

type Ok = Extract<GenerateResult, { ok: true }>;

export function GeneratorForm({ settings, profile, departments, categories, originals }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isRevision, setIsRevision] = useState(false);
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
        parent_document_id: g("parent_document_id"),
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
      setTimeout(() => document.getElementById("result-panel")?.scrollIntoView({ behavior: "smooth" }), 50);
    });
  }

  function reset() {
    setResult(null);
    setIsRevision(false);
    formRef.current?.reset();
  }

  return (
    <div className="space-y-6">
      <form ref={formRef} onSubmit={submit} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>1. User Information</CardTitle>
            <CardDescription>Populated from your profile.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Applicant's Full Name" required error={errors.applicant_name} className="sm:col-span-2">
              <Input name="applicant_name" defaultValue={profile.name} />
            </Field>
            <Field label="Employee ID">
              <Input value={profile.employeeId} readOnly disabled placeholder="Not assigned" />
            </Field>
            <Field label="Your Department">
              <Input value={departments.find((d) => d.id === profile.departmentId)?.department_name ?? "Not assigned"} readOnly disabled />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Recipient <span className="font-normal text-muted-foreground">(optional)</span></CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="To Whom We Send"><Input name="recipient_name" /></Field>
            <Field label="Recipient Organization"><Input name="recipient_organization" /></Field>
            <Field label="Recipient Email" error={errors.recipient_email} className="sm:col-span-2">
              <Input name="recipient_email" type="email" />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>3. Core Document Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
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
            <Field label="Document Description" className="sm:col-span-2">
              <Textarea name="document_description" />
            </Field>

            <div className="space-y-3 rounded-lg border bg-muted/50 p-4 sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={isRevision}
                  onChange={(e) => setIsRevision(e.target.checked)} />
                Is there a revision?
              </label>
              {isRevision ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Original document being revised" required error={errors.parent_document_id} className="sm:col-span-2"
                    hint="Department and category are inherited from the original document.">
                    <Select name="parent_document_id" defaultValue="">
                      <option value="">Select original document…</option>
                      {originals.map((o) => <option key={o.id} value={o.id}>{o.document_code} — {o.document_title}</option>)}
                    </Select>
                  </Field>
                  <Field label="Revision notes" className="sm:col-span-2"><Textarea name="revision_notes" /></Field>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Unchecked: revision {String(settings.default_revision).padStart(settings.revision_format, "0")} is issued. Format example:{" "}
                  <span className="font-mono">{previewCode(settings, year)}</span>
                </p>
              )}
            </div>

            <Field label="Remarks" className="sm:col-span-2"><Textarea name="remarks" /></Field>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={pending} className="w-full sm:w-auto">
            <FilePlus2 className="h-4 w-4" /> Generate Code
          </Button>
        </div>
      </form>

      {result && <ResultPanel result={result} settings={settings} onReset={reset} />}
    </div>
  );
}

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
    <Card id="result-panel" className="border-2 border-primary/40 bg-blue-50/60">
      <CardContent className="space-y-5 p-6 text-center sm:p-8">
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-success">
          <CheckCircle2 className="h-4 w-4" /> Code generated successfully
        </p>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Final Unique Code</p>
          <h2 className="mt-1 break-all font-mono text-3xl font-extrabold text-primary sm:text-5xl" data-testid="final-code">
            {doc.document_code}
          </h2>
        </div>
        <CodeBreakdown parts={codeParts(doc, settings, result.department.code, result.category.code, result.sequenceLength)} />
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button variant="outline" onClick={async () => {
            try { await navigator.clipboard.writeText(doc.document_code); toast.success("Copied to clipboard"); }
            catch { toast.error("Copy failed - select the code manually"); }
          }}><Copy className="h-4 w-4" /> Copy Document Code</Button>
          <Button variant="outline" onClick={() => downloadPdf(pdfDoc)}><Download className="h-4 w-4" /> Download as PDF</Button>
          <Button variant="outline" onClick={() => printPdf(pdfDoc)}><Printer className="h-4 w-4" /> Print Reference</Button>
          <Button onClick={onReset}><FilePlus2 className="h-4 w-4" /> Generate Another Code</Button>
        </div>
      </CardContent>
    </Card>
  );
}
