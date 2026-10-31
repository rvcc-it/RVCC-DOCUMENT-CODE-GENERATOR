export type Role = "admin" | "management" | "employee";
export type ActiveStatus = "active" | "inactive";
export type DocStatus = "active" | "revised" | "cancelled";

export interface Department { id: string; department_name: string; department_code: string; status: ActiveStatus; created_at: string }
export interface Category {
  id: string; category_name: string; category_code: string; status: ActiveStatus;
  sequence_length: number | null; created_at: string;
}
export interface Profile {
  id: string; full_name: string; employee_id: string | null; email: string;
  department_id: string | null; role: Role; status: ActiveStatus; created_at: string;
}
export interface CompanySettings {
  id: 1; company_name: string; company_code: string; company_logo_url: string | null;
  current_year: number | null; year_format: "YY" | "YYYY"; sequence_length: number;
  revision_format: number; default_revision: number; separator: string; numbering_format: string;
  sequence_reset: "yearly" | "never"; smtp_provider: "none" | "resend" | "smtp"; notify_recipient: boolean;
}
export interface GeneratedDocument {
  id: string; document_code: string; company_code: string; document_year: number;
  sequence_number: number; revision_number: number; parent_document_id: string | null;
  applicant_id: string; applicant_name: string; employee_id: string | null;
  department_id: string; category_id: string; document_title: string;
  document_description: string | null; recipient_name: string | null;
  recipient_organization: string | null; recipient_email: string | null;
  remarks: string | null; status: DocStatus; generated_at: string; created_at: string;
}
export interface DocumentRow extends GeneratedDocument {
  departments: { department_name: string; department_code: string } | null;
  document_categories: { category_name: string; category_code: string } | null;
}
