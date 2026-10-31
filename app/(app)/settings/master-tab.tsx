"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { saveCategory, saveDepartment, setMasterStatus } from "./actions";

interface Row { id: string; name: string; code: string; status: "active" | "inactive"; extra?: number; seqLen?: number | null }

export function MasterTab({ kind, rows, defaultSeqLen }: { kind: "department" | "category"; rows: Row[]; defaultSeqLen?: number }) {
  const router = useRouter();
  const isDept = kind === "department";
  const label = isDept ? "Department" : "Document category";
  const [edit, setEdit] = useState<Row | "new" | null>(null);
  const [toggle, setToggle] = useState<Row | null>(null);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ name: "", code: "", seqLen: "" });

  const open = (r: Row | "new") => {
    setForm(r === "new" ? { name: "", code: "", seqLen: "" } : { name: r.name, code: r.code, seqLen: r.seqLen?.toString() ?? "" });
    setEdit(r);
  };

  const submit = () =>
    start(async () => {
      const id = edit !== "new" && edit ? edit.id : undefined;
      const res = isDept
        ? await saveDepartment({ id, name: form.name, code: form.code })
        : await saveCategory({ id, name: form.name, code: form.code, sequence_length: form.seqLen ? Number(form.seqLen) : null });
      if (res.ok) { toast.success(`${label} saved`); setEdit(null); router.refresh(); } else toast.error(res.error);
    });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{isDept ? "Departments" : "Document categories"}</CardTitle>
        <Button size="sm" onClick={() => open("new")}><Plus className="h-4 w-4" /> Add</Button>
      </CardHeader>
      <Table>
        <THead><TR className="hover:bg-transparent">
          <TH>Name</TH><TH>Code</TH>{isDept ? <TH>Documents</TH> : <TH>Sequence digits</TH>}<TH>Status</TH><TH className="text-right">Actions</TH>
        </TR></THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="font-medium">{r.name}</TD>
              <TD className="font-mono">{r.code}</TD>
              <TD>{isDept ? r.extra : r.seqLen ?? `${defaultSeqLen} (default)`}</TD>
              <TD><Badge tone={r.status === "active" ? "green" : "grey"} className="capitalize">{r.status}</Badge></TD>
              <TD className="text-right">
                <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => open(r)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label={r.status === "active" ? "Deactivate" : "Activate"} onClick={() => setToggle(r)}>
                  <Power className="h-4 w-4" />
                </Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent title={`${edit === "new" ? "Add" : "Edit"} ${label.toLowerCase()}`}
          description="Codes appear in generated document numbers. Existing documents keep their original code.">
          <div className="grid gap-4">
            <Field label="Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Code" required hint="1-6 letters or digits">
              <Input value={form.code} maxLength={6} className="font-mono uppercase" onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </Field>
            {!isDept && (
              <Field label="Sequence digits (optional override)" hint={`Blank uses company default (${defaultSeqLen}).`}>
                <Input type="number" min={1} max={8} value={form.seqLen} onChange={(e) => setForm({ ...form, seqLen: e.target.value })} />
              </Field>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
              <Button loading={pending} onClick={submit}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toggle} onOpenChange={(o) => !o && setToggle(null)}
        title={toggle?.status === "active" ? `Deactivate ${toggle?.name}?` : `Activate ${toggle?.name}?`}
        description={toggle?.status === "active"
          ? "It will no longer be selectable when generating codes. Existing documents are unaffected."
          : "It will become available in the generator again."}
        destructive={toggle?.status === "active"}
        confirmLabel={toggle?.status === "active" ? "Deactivate" : "Activate"}
        onConfirm={async () => {
          if (!toggle) return;
          const res = await setMasterStatus(isDept ? "doc_code_gen_departments" : "doc_code_gen_document_categories", toggle.id, toggle.status !== "active");
          if (res.ok) { toast.success("Status updated"); router.refresh(); } else toast.error(res.error);
        }}
      />
    </Card>
  );
}
