-- Only administrators can see every generated document. Everyone else (including management) sees their own.
create or replace function doc_code_gen_can_view_all() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(doc_code_gen_current_role() = 'admin', false) $$;

-- Remove the sample non-admin accounts created by the first setup script (safe if they do not exist).
-- Users who already generated codes cannot be deleted (history is permanent); they are deactivated instead.
delete from doc_code_gen_users u
where u.email in ('manager@rvce.com.sa', 'employee@rvce.com.sa')
  and not exists (select 1 from doc_code_gen_generated_documents g where g.applicant_id = u.id);

update doc_code_gen_users set status = 'inactive'
where email in ('manager@rvce.com.sa', 'employee@rvce.com.sa');
