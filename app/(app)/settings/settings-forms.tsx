"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { NUMBERING_TOKENS, previewCode } from "@/lib/numbering";
import type { CompanySettings } from "@/lib/types";
import { saveSettings } from "./actions";

function useSave() {
  const [pending, start] = useTransition();
  const save = (patch: Record<string, unknown>) =>
    start(async () => {
      const r = await saveSettings(patch);
      r.ok ? toast.success("Settings saved") : toast.error(r.error);
    });
  return { pending, save };
}

export function CompanyTab({ settings }: { settings: CompanySettings }) {
  const { pending, save } = useSave();
  const [v, setV] = useState({
    company_name: settings.company_name, company_code: settings.company_code,
    company_logo_url: settings.company_logo_url ?? "", current_year: settings.current_year?.toString() ?? "",
    smtp_provider: settings.smtp_provider, notify_recipient: settings.notify_recipient,
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV({ ...v, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  return (
    <Card>
      <CardHeader><CardTitle>Company settings</CardTitle></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Company Name" required><Input value={v.company_name} onChange={set("company_name")} /></Field>
        <Field label="Company Short Code" required hint="Used as {COMPANY}. Changing it starts new sequences.">
          <Input value={v.company_code} onChange={(e) => setV({ ...v, company_code: e.target.value.toUpperCase() })} maxLength={10} />
        </Field>
        <Field label="Company Logo URL" className="sm:col-span-2"><Input type="url" value={v.company_logo_url} onChange={set("company_logo_url")} placeholder="https://…/logo.png" /></Field>
        <Field label="Current Document Year" hint="Leave blank to follow the calendar year.">
          <Input type="number" value={v.current_year} onChange={set("current_year")} placeholder={String(new Date().getFullYear())} />
        </Field>
        <Field label="Email notifications to recipients">
          <Select value={v.smtp_provider} onChange={set("smtp_provider")}>
            <option value="none">Disabled</option><option value="resend">Resend</option><option value="smtp">SMTP</option>
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" className="h-4 w-4" checked={v.notify_recipient} onChange={set("notify_recipient")} />
          Email the recipient when a code is generated with a recipient email
        </label>
        <div className="sm:col-span-2">
          <Button loading={pending} onClick={() => save(v)}>Save company settings</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function NumberingTab({ settings }: { settings: CompanySettings }) {
  const { pending, save } = useSave();
  const [v, setV] = useState({
    numbering_format: settings.numbering_format, year_format: settings.year_format, sequence_length: String(settings.sequence_length),
    revision_format: String(settings.revision_format), default_revision: String(settings.default_revision),
    separator: settings.separator, sequence_reset: settings.sequence_reset,
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const year = settings.current_year ?? new Date().getFullYear();
  const preview = previewCode({
    company_code: settings.company_code, numbering_format: v.numbering_format, year_format: v.year_format,
    sequence_length: Math.min(8, Math.max(1, Number(v.sequence_length) || 3)),
    revision_format: Math.min(4, Math.max(1, Number(v.revision_format) || 2)), separator: v.separator,
  }, year);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Numbering configuration</CardTitle>
        <CardDescription>Changes apply to codes generated from now on. Existing codes never change.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border-2 border-dashed border-primary/40 bg-blue-50 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Live preview</p>
          <p className="break-all font-mono text-2xl font-bold text-primary">{preview}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Numbering format" required className="sm:col-span-2"
            hint={`Tokens: ${NUMBERING_TOKENS.join(" ")}. {COMPANY} {DEPT} {CAT} {SEQ} {REV} are required.`}>
            <Input className="font-mono" value={v.numbering_format} onChange={set("numbering_format")} />
          </Field>
          <Field label="Separator character"><Input value={v.separator} maxLength={2} onChange={set("separator")} /></Field>
          <Field label="Year format">
            <Select value={v.year_format} onChange={set("year_format")}><option value="YY">YY (26)</option><option value="YYYY">YYYY (2026)</option></Select>
          </Field>
          <Field label="Sequence length (digits)"><Input type="number" min={1} max={8} value={v.sequence_length} onChange={set("sequence_length")} /></Field>
          <Field label="Revision format (digits)"><Input type="number" min={1} max={4} value={v.revision_format} onChange={set("revision_format")} /></Field>
          <Field label="Default revision number"><Input type="number" min={0} value={v.default_revision} onChange={set("default_revision")} /></Field>
          <Field label="Sequence reset rule">
            <Select value={v.sequence_reset} onChange={set("sequence_reset")}><option value="yearly">Reset every year</option><option value="never">Never reset</option></Select>
          </Field>
        </div>
        <Button loading={pending} onClick={() => save(v)}>Save numbering rules</Button>
      </CardContent>
    </Card>
  );
}
