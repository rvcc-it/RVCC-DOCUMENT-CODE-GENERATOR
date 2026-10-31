import type { CompanySettings } from "./types";

export const NUMBERING_TOKENS = ["{COMPANY}", "{YEAR}", "{DEPT}", "{CAT}", "{SEQ}", "{REV}", "{SEP}"] as const;

type FormatInput = Pick<
  CompanySettings,
  "numbering_format" | "company_code" | "year_format" | "sequence_length" | "revision_format" | "separator"
>;

/**
 * Display-only preview. The authoritative code is always built by the
 * PostgreSQL function build_document_code(); keep both in sync.
 */
export function previewCode(s: FormatInput, year: number, dept = "O", cat = "F", seq = 1, rev = 0) {
  const pad = (n: number, l: number) => String(n).padStart(l, "0");
  return s.numbering_format
    .replaceAll("{COMPANY}", s.company_code)
    .replaceAll("{YEAR}", s.year_format === "YYYY" ? pad(year, 4) : pad(year % 100, 2))
    .replaceAll("{DEPT}", dept)
    .replaceAll("{CAT}", cat)
    .replaceAll("{SEQ}", pad(seq, s.sequence_length))
    .replaceAll("{REV}", pad(rev, s.revision_format))
    .replaceAll("{SEP}", s.separator);
}

export interface CodePart { label: string; value: string }

/** Splits a generated document into labelled segments for the result panel. */
export function codeParts(
  d: { company_code: string; document_year: number; sequence_number: number; revision_number: number },
  s: FormatInput, dept: string, cat: string, seqLen: number,
): CodePart[] {
  const pad = (n: number, l: number) => String(n).padStart(l, "0");
  return [
    { label: "Company", value: d.company_code },
    { label: "Year", value: s.year_format === "YYYY" ? pad(d.document_year, 4) : pad(d.document_year % 100, 2) },
    { label: "Department", value: dept },
    { label: "Category", value: cat },
    { label: "Sequence", value: pad(d.sequence_number, seqLen) },
    { label: "Revision", value: pad(d.revision_number, s.revision_format) },
  ];
}
