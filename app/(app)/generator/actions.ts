"use server";

import { z } from "zod";
import { getCompanySettings, requireSession } from "@/lib/auth";
import { sendRecipientNotice } from "@/lib/email";
import type { GeneratedDocument } from "@/lib/types";

const opt = z.string().trim().max(500).optional().default("");

const schema = z
  .object({
    applicant_name: z.string().trim().min(1, "Applicant name is required").max(150),
    recipient_name: opt,
    recipient_organization: opt,
    recipient_email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional().default(""),
    department_id: z.string().optional().default(""),
    category_id: z.string().optional().default(""),
    document_title: z.string().trim().max(250),
    document_description: z.string().trim().max(2000).optional().default(""),
    remarks: z.string().trim().max(2000).optional().default(""),
    is_revision: z.boolean().default(false),
    parent_document_id: z.string().optional().default(""),
    revision_notes: z.string().trim().max(1000).optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.is_revision) {
      if (!z.uuid().safeParse(v.parent_document_id).success)
        ctx.addIssue({ code: "custom", path: ["parent_document_id"], message: "Select the document being revised" });
    } else {
      if (!z.uuid().safeParse(v.department_id).success)
        ctx.addIssue({ code: "custom", path: ["department_id"], message: "Select a department" });
      if (!z.uuid().safeParse(v.category_id).success)
        ctx.addIssue({ code: "custom", path: ["category_id"], message: "Select a document type" });
    }
  });

export type GenerateInput = z.input<typeof schema>;
export type GenerateResult =
  | {
      ok: true;
      doc: GeneratedDocument;
      department: { name: string; code: string };
      category: { name: string; code: string };
      sequenceLength: number;
      emailed: boolean;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function generateCode(input: GenerateInput): Promise<GenerateResult> {
  const { supabase } = await requireSession();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ||= i.message;
    return { ok: false, error: "Please correct the highlighted fields.", fieldErrors };
  }
  const v = parsed.data;

  // The code is produced and stored atomically by PostgreSQL (see generate_document_code()).
  const { data, error } = await supabase.rpc("doc_code_gen_generate_code", {
    p_department_id: v.is_revision ? null : v.department_id,
    p_category_id: v.is_revision ? null : v.category_id,
    p_document_title: v.document_title,
    p_document_description: v.document_description || null,
    p_recipient_name: v.recipient_name || null,
    p_recipient_organization: v.recipient_organization || null,
    p_recipient_email: v.recipient_email || null,
    p_remarks: v.remarks || null,
    p_applicant_name: v.applicant_name,
    p_is_revision: v.is_revision,
    p_parent_document_id: v.is_revision ? v.parent_document_id : null,
    p_revision_notes: v.revision_notes || null,
  });
  if (error) return { ok: false, error: error.message };
  const doc = data as GeneratedDocument;

  const [{ data: dept }, { data: cat }, settings] = await Promise.all([
    supabase.from("doc_code_gen_departments").select("department_name,department_code").eq("id", doc.department_id).single(),
    supabase.from("doc_code_gen_document_categories").select("category_name,category_code,sequence_length").eq("id", doc.category_id).single(),
    getCompanySettings(),
  ]);

  let emailed = false;
  if (doc.recipient_email) {
    emailed = (await sendRecipientNotice(settings, {
      to: doc.recipient_email, recipientName: doc.recipient_name, code: doc.document_code,
      title: doc.document_title, applicant: doc.applicant_name,
    })).sent;
  }

  return {
    ok: true, doc,
    department: { name: dept?.department_name ?? "", code: dept?.department_code ?? "" },
    category: { name: cat?.category_name ?? "", code: cat?.category_code ?? "" },
    sequenceLength: cat?.sequence_length ?? settings.sequence_length,
    emailed,
  };
}
