"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Copy, Download, Eye, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadPdf, printPdf, type PdfDoc } from "@/lib/pdf";

type DocInfo = Omit<PdfDoc, "revision" | "company"> & { revisionNumber: number };

export function RowActions({ id, doc, company, revisionDigits }: { id: string; doc: DocInfo; company: string; revisionDigits: number }) {
  const pdf: PdfDoc = { ...doc, company, revision: String(doc.revisionNumber).padStart(revisionDigits, "0") };
  return (
    <div className="flex justify-end gap-1">
      <Link href={`/history/${id}`} aria-label="View details">
        <Button variant="ghost" size="icon" tabIndex={-1}><Eye className="h-4 w-4" /></Button>
      </Link>
      <Button variant="ghost" size="icon" aria-label="Copy code" onClick={async () => {
        try { await navigator.clipboard.writeText(doc.code); toast.success("Copied " + doc.code); } catch { toast.error("Copy failed"); }
      }}><Copy className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" aria-label="Download PDF" onClick={() => downloadPdf(pdf)}><Download className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" aria-label="Print" onClick={() => printPdf(pdf)}><Printer className="h-4 w-4" /></Button>
    </div>
  );
}
