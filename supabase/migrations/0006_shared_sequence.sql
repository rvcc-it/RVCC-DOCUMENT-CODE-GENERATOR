-- One running number per company + year, shared by ALL departments and document categories.
-- RVCC26-IT-F-001-00, RVCC26-HR-E-002-00, RVCC26-IT-F-003-00 ...
-- Safe to re-run. Existing codes are untouched; numbering continues after the highest number already issued.

truncate doc_code_gen_document_sequences;
alter table doc_code_gen_document_sequences drop column if exists category_id;  -- also drops the old unique key
alter table doc_code_gen_document_sequences drop column if exists department_id;
alter table doc_code_gen_document_sequences drop constraint if exists doc_code_gen_document_sequences_company_code_year_department_id_key;
alter table doc_code_gen_document_sequences drop constraint if exists doc_code_gen_document_sequences_uq;
alter table doc_code_gen_document_sequences
  add constraint doc_code_gen_document_sequences_uq unique (company_code, year);

-- rebuild counters from what has already been issued (originals only; revisions reuse their original's number)
insert into doc_code_gen_document_sequences (company_code, year, last_sequence)
select d.company_code,
       case when (select sequence_reset from doc_code_gen_company_settings where id = 1) = 'yearly' then d.document_year else 0 end,
       max(d.sequence_number)
from doc_code_gen_generated_documents d
group by 1, 2
on conflict (company_code, year)
  do update set last_sequence = greatest(doc_code_gen_document_sequences.last_sequence, excluded.last_sequence);

create or replace function doc_code_gen_generate_code(
  p_department_id uuid,
  p_category_id uuid,
  p_document_title text,
  p_document_description text default null,
  p_recipient_name text default null,
  p_recipient_organization text default null,
  p_recipient_email text default null,
  p_remarks text default null,
  p_applicant_name text default null,
  p_is_revision boolean default false,
  p_parent_document_id uuid default null,
  p_revision_notes text default null
) returns doc_code_gen_generated_documents
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile doc_code_gen_users;
  s doc_code_gen_company_settings;
  v_dept doc_code_gen_departments;
  v_cat doc_code_gen_document_categories;
  v_root doc_code_gen_generated_documents;
  v_root_id uuid;
  v_year int;
  v_seq_year int;
  v_seq int;
  v_rev int;
  v_len int;
  v_code text;
  v_doc doc_code_gen_generated_documents;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  select * into v_profile from doc_code_gen_users where id = v_uid and status = 'active';
  if not found then raise exception 'Account is inactive or has no profile' using errcode = '42501'; end if;
  if p_recipient_email is not null and p_recipient_email <> ''
     and p_recipient_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Recipient email is invalid';
  end if;

  select * into s from doc_code_gen_company_settings where id = 1;

  if p_is_revision then
    if p_parent_document_id is null then raise exception 'Select the original document to revise'; end if;
    select coalesce(parent_document_id, id) into v_root_id
      from doc_code_gen_generated_documents where id = p_parent_document_id;
    if v_root_id is null then raise exception 'Original document not found'; end if;
    select * into v_root from doc_code_gen_generated_documents where id = v_root_id for update;
    if v_root.status = 'cancelled' then raise exception 'Cancelled documents cannot be revised'; end if;
    if v_profile.role = 'employee' and v_root.applicant_id <> v_uid then
      raise exception 'You can only revise your own documents' using errcode = '42501';
    end if;
    select * into v_dept from doc_code_gen_departments where id = v_root.department_id;
    select * into v_cat  from doc_code_gen_document_categories where id = v_root.category_id;
    select coalesce(max(revision_number), v_root.revision_number) + 1 into v_rev
      from doc_code_gen_generated_documents where parent_document_id = v_root.id;
    v_year := v_root.document_year;
    v_seq := v_root.sequence_number;
  else
    select * into v_dept from doc_code_gen_departments where id = p_department_id and status = 'active';
    if not found then raise exception 'Invalid or inactive department'; end if;
    select * into v_cat from doc_code_gen_document_categories where id = p_category_id and status = 'active';
    if not found then raise exception 'Invalid or inactive document category'; end if;

    v_year := coalesce(s.current_year, extract(year from now())::int);
    v_seq_year := case when s.sequence_reset = 'yearly' then v_year else 0 end;
    v_rev := s.default_revision;

    -- row-level lock via UPSERT: concurrent callers queue on this row. Department and category are NOT part of the key.
    insert into doc_code_gen_document_sequences (company_code, year, last_sequence)
      values (s.company_code, v_seq_year, 1)
    on conflict (company_code, year)
      do update set last_sequence = doc_code_gen_document_sequences.last_sequence + 1
    returning last_sequence into v_seq;
  end if;

  v_len := coalesce(v_cat.sequence_length, s.sequence_length);
  v_code := doc_code_gen_build_code(s.numbering_format, s.company_code, v_year, s.year_format,
              v_dept.department_code, v_cat.category_code, v_seq, v_len, v_rev, s.revision_format, s.separator);

  insert into doc_code_gen_generated_documents (
    document_code, company_code, document_year, sequence_number, revision_number, parent_document_id,
    applicant_id, applicant_name, employee_id, department_id, category_id, document_title, document_description,
    recipient_name, recipient_organization, recipient_email, remarks
  ) values (
    v_code, s.company_code, v_year, v_seq, v_rev, case when p_is_revision then v_root.id end,
    v_uid, coalesce(nullif(trim(p_applicant_name), ''), v_profile.full_name), v_profile.employee_id,
    v_dept.id, v_cat.id, coalesce(trim(p_document_title), ''), nullif(trim(p_document_description), ''),
    nullif(trim(p_recipient_name), ''), nullif(trim(p_recipient_organization), ''),
    nullif(trim(p_recipient_email), ''), nullif(trim(p_remarks), '')
  ) returning * into v_doc;

  if p_is_revision then
    update doc_code_gen_generated_documents set status = 'revised'
      where status = 'active' and id <> v_doc.id
        and (id = v_root.id or parent_document_id = v_root.id);
    insert into doc_code_gen_document_revisions (document_id, revision_number, document_code, revision_notes, created_by)
      values (v_root.id, v_rev, v_code, p_revision_notes, v_uid);
  end if;

  insert into doc_code_gen_audit_logs (user_id, action, table_name, record_id, new_values)
    values (v_uid, case when p_is_revision then 'REVISE' else 'GENERATE' end, 'doc_code_gen_generated_documents',
            v_doc.id::text, to_jsonb(v_doc));
  return v_doc;
end $$;
