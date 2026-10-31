"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";

export async function cancelDocument(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await getSession();
  if (!s || s.profile.role !== "admin") return { ok: false, error: "Administrator access required." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid document" };
  const { error } = await s.supabase.rpc("doc_code_gen_cancel_document", { p_document_id: id, p_reason: null });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/history");
  return { ok: true };
}
