-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table doc_code_gen_departments          enable row level security;
alter table doc_code_gen_document_categories  enable row level security;
alter table doc_code_gen_users             enable row level security;
alter table doc_code_gen_company_settings     enable row level security;
alter table doc_code_gen_document_sequences   enable row level security;
alter table doc_code_gen_generated_documents  enable row level security;
alter table doc_code_gen_document_revisions   enable row level security;
alter table doc_code_gen_audit_logs           enable row level security;
alter table doc_code_gen_user_credentials     enable row level security;  -- no policies, no grants: server (service role) only

-- master data: everyone signed in reads, admins write
create policy dept_read  on doc_code_gen_departments for select to authenticated using (true);
create policy dept_write on doc_code_gen_departments for all to authenticated using (doc_code_gen_is_admin()) with check (doc_code_gen_is_admin());
create policy cat_read   on doc_code_gen_document_categories for select to authenticated using (true);
create policy cat_write  on doc_code_gen_document_categories for all to authenticated using (doc_code_gen_is_admin()) with check (doc_code_gen_is_admin());
create policy settings_read  on doc_code_gen_company_settings for select to authenticated using (true);
create policy settings_write on doc_code_gen_company_settings for update to authenticated
  using (doc_code_gen_is_admin()) with check (doc_code_gen_is_admin());

-- doc_code_gen_users (role/status/department changes by non-admins are blocked by guard_profiles trigger)
create policy profiles_read on doc_code_gen_users for select to authenticated
  using (id = auth.uid() or doc_code_gen_can_view_all());
create policy profiles_update_self on doc_code_gen_users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all on doc_code_gen_users for all to authenticated
  using (doc_code_gen_is_admin()) with check (doc_code_gen_is_admin());

-- generated documents: read-only through the API.
-- Writes happen only via doc_code_gen_generate_code() / doc_code_gen_cancel_document() (SECURITY DEFINER).
create policy gd_read on doc_code_gen_generated_documents for select to authenticated
  using (applicant_id = auth.uid() or doc_code_gen_can_view_all());
create policy rev_read on doc_code_gen_document_revisions for select to authenticated
  using (exists (select 1 from doc_code_gen_generated_documents g where g.id = document_id
                 and (g.applicant_id = auth.uid() or doc_code_gen_can_view_all())));

-- audit logs: admins only. doc_code_gen_document_sequences: no policy => no direct access.
create policy audit_read on doc_code_gen_audit_logs for select to authenticated using (doc_code_gen_is_admin());

-- Table privileges: strip everything, then grant the minimum back.
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select on doc_code_gen_departments, doc_code_gen_document_categories, doc_code_gen_company_settings, doc_code_gen_users,
                doc_code_gen_generated_documents, doc_code_gen_document_revisions, doc_code_gen_audit_logs, doc_code_gen_department_counts to authenticated;
grant insert, update, delete on doc_code_gen_departments, doc_code_gen_document_categories to authenticated;
grant update on doc_code_gen_company_settings to authenticated;
grant insert, update on doc_code_gen_users to authenticated;

grant execute on function
  doc_code_gen_generate_code(uuid,uuid,text,text,text,text,text,text,text,boolean,uuid,text) to authenticated;
grant execute on function doc_code_gen_cancel_document(uuid,text) to authenticated;
grant execute on function doc_code_gen_dashboard_stats(date,date,uuid) to authenticated;
grant execute on function doc_code_gen_current_role(), doc_code_gen_is_admin(), doc_code_gen_can_view_all() to authenticated;
