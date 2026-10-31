-- Only needed if you already ran the FIRST version of these migrations (unprefixed table names).
-- Safe to skip on a fresh project. Drops the old objects so the prefixed schema can be created.
drop table if exists audit_logs, document_revisions, generated_documents, document_sequences,
  company_settings, document_categories, departments, profiles cascade;
drop view if exists department_counts;
drop function if exists generate_document_code(uuid,uuid,text,text,text,text,text,text,text,boolean,uuid,text) cascade;
drop function if exists cancel_document(uuid,text) cascade;
drop function if exists dashboard_stats(date,date,uuid) cascade;
drop function if exists build_document_code(text,text,int,text,text,text,int,int,int,int,text) cascade;
drop function if exists current_user_role(), is_admin(), can_view_all(), set_updated_at(), guard_generated_documents(),
  guard_append_only(), guard_profiles(), audit_row(), handle_new_user() cascade;
drop type if exists user_role, active_status, document_status cascade;
