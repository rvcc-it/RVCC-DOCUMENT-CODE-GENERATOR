-- =====================================================================
-- ONE-SHOT SETUP: cleans any partial install, creates all doc_code_gen_ tables,
-- RLS, seed data, and the first users. Paste into Supabase SQL editor and run once.
-- WARNING: the cleanup section deletes existing doc_code_gen_ data.
-- =====================================================================
drop table if exists doc_code_gen_audit_logs, doc_code_gen_document_revisions, doc_code_gen_generated_documents,
  doc_code_gen_document_sequences, doc_code_gen_user_credentials, doc_code_gen_company_settings,
  doc_code_gen_document_categories, doc_code_gen_departments, doc_code_gen_users cascade;
drop view if exists doc_code_gen_department_counts;
drop type if exists doc_code_gen_user_role, doc_code_gen_active_status, doc_code_gen_document_status cascade;

-- =====================================================================
-- Unique Numbering Portal - core schema
-- =====================================================================
create extension if not exists pgcrypto;

create type doc_code_gen_user_role   as enum ('admin', 'management', 'employee');
create type doc_code_gen_active_status as enum ('active', 'inactive');
create type doc_code_gen_document_status as enum ('active', 'revised', 'cancelled');

create or replace function doc_code_gen_set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- master data ----------
create table doc_code_gen_departments (
  id uuid primary key default gen_random_uuid(),
  department_name text not null,
  department_code text not null,
  status doc_code_gen_active_status not null default 'active',
  created_at timestamptz not null default now(),
  constraint departments_code_fmt check (department_code ~ '^[A-Z0-9]{1,6}$')
);
create unique index departments_code_uq on doc_code_gen_departments (upper(department_code));
create unique index departments_name_uq on doc_code_gen_departments (lower(department_name));

create table doc_code_gen_document_categories (
  id uuid primary key default gen_random_uuid(),
  category_name text not null,
  category_code text not null,
  status doc_code_gen_active_status not null default 'active',
  -- optional category-specific numbering rule (null = use company default)
  sequence_length smallint check (sequence_length between 1 and 8),
  created_at timestamptz not null default now(),
  constraint categories_code_fmt check (category_code ~ '^[A-Z0-9]{1,6}$')
);
create unique index categories_code_uq on doc_code_gen_document_categories (upper(category_code));
create unique index categories_name_uq on doc_code_gen_document_categories (lower(category_name));

create table doc_code_gen_users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null default '',
  employee_id text,
  email text not null,
  department_id uuid references doc_code_gen_departments(id),
  role doc_code_gen_user_role not null default 'employee',
  status doc_code_gen_active_status not null default 'active',
  created_at timestamptz not null default now()
);
create unique index users_email_uq on doc_code_gen_users (lower(email));
create unique index profiles_employee_id_uq on doc_code_gen_users (employee_id)
  where employee_id is not null and employee_id <> '';

-- Password hashes live in their own table: no client role can read it (no grants, RLS on, no policies).
-- Hashes are bcrypt, so rows can be created from SQL (doc_code_gen_create_user) or by the app.
create table doc_code_gen_user_credentials (
  user_id uuid primary key references doc_code_gen_users(id) on delete cascade,
  password_hash text not null,
  session_version integer not null default 1,   -- bump to sign a user out everywhere
  updated_at timestamptz not null default now()
);

-- single-row configuration table
create table doc_code_gen_company_settings (
  id smallint primary key default 1 check (id = 1),
  company_name text not null default 'RVCC',
  company_code text not null default 'RVCC' check (company_code ~ '^[A-Z0-9]{1,10}$'),
  company_logo_url text,
  current_year smallint,                          -- null = use calendar year
  year_format text not null default 'YY' check (year_format in ('YY','YYYY')),
  sequence_length smallint not null default 3 check (sequence_length between 1 and 8),
  revision_format smallint not null default 2 check (revision_format between 1 and 4), -- digits
  default_revision smallint not null default 0 check (default_revision >= 0),
  separator text not null default '-' check (char_length(separator) <= 2),
  -- tokens: {COMPANY} {YEAR} {DEPT} {CAT} {SEQ} {REV} {SEP}
  numbering_format text not null default '{COMPANY}{YEAR}{SEP}{DEPT}{SEP}{CAT}{SEP}{SEQ}{SEP}{REV}',
  sequence_reset text not null default 'yearly' check (sequence_reset in ('yearly','never')),
  smtp_provider text not null default 'none' check (smtp_provider in ('none','resend','smtp')),
  notify_recipient boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger company_settings_updated before update on doc_code_gen_company_settings
  for each row execute function doc_code_gen_set_updated_at();
insert into doc_code_gen_company_settings (id) values (1);

-- ---------- numbering ----------
create table doc_code_gen_document_sequences (
  id uuid primary key default gen_random_uuid(),
  company_code text not null,
  year smallint not null,                -- 0 when sequence_reset = 'never'
  last_sequence integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_code, year)
);
create trigger document_sequences_updated before update on doc_code_gen_document_sequences
  for each row execute function doc_code_gen_set_updated_at();

create table doc_code_gen_generated_documents (
  id uuid primary key default gen_random_uuid(),
  document_code text not null unique,
  company_code text not null,
  document_year smallint not null,
  sequence_number integer not null,
  revision_number integer not null default 0,
  parent_document_id uuid references doc_code_gen_generated_documents(id),   -- original (rev 0) doc
  applicant_id uuid not null references doc_code_gen_users(id),
  applicant_name text not null,
  employee_id text,
  department_id uuid not null references doc_code_gen_departments(id),
  category_id uuid not null references doc_code_gen_document_categories(id),
  document_title text not null,
  document_description text,
  recipient_name text,
  recipient_organization text,
  recipient_email text,
  remarks text,
  status doc_code_gen_document_status not null default 'active',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- each revision number may exist only once per original document
  constraint gd_revision_chain_uq unique (parent_document_id, revision_number)
);
create index gd_applicant_idx on doc_code_gen_generated_documents (applicant_id, generated_at desc);
create index gd_dept_idx on doc_code_gen_generated_documents (department_id);
create index gd_cat_idx on doc_code_gen_generated_documents (category_id);
create index gd_generated_idx on doc_code_gen_generated_documents (generated_at desc);
create index gd_parent_idx on doc_code_gen_generated_documents (parent_document_id);

create table doc_code_gen_document_revisions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references doc_code_gen_generated_documents(id),
  revision_number integer not null,
  document_code text not null,
  revision_notes text,
  created_by uuid references doc_code_gen_users(id),
  created_at timestamptz not null default now(),
  unique (document_id, revision_number)
);

create table doc_code_gen_audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);
create index audit_created_idx on doc_code_gen_audit_logs (created_at desc);

-- =====================================================================
-- helpers
-- =====================================================================
create or replace function doc_code_gen_current_role() returns doc_code_gen_user_role
language sql stable security definer set search_path = public as $$
  select role from doc_code_gen_users where id = auth.uid() and status = 'active'
$$;

create or replace function doc_code_gen_is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(doc_code_gen_current_role() = 'admin', false) $$;

create or replace function doc_code_gen_can_view_all() returns boolean
language sql stable security definer set search_path = public as
$ select coalesce(doc_code_gen_current_role() = 'admin', false) $;

-- Builds the visible code from the configured template and its parts.
create or replace function doc_code_gen_build_code(
  p_format text, p_company text, p_year int, p_year_format text, p_dept text,
  p_cat text, p_seq int, p_seq_len int, p_rev int, p_rev_len int, p_sep text
) returns text language plpgsql immutable as $$
declare r text := p_format;
begin
  r := replace(r, '{COMPANY}', p_company);
  r := replace(r, '{YEAR}', case when p_year_format = 'YYYY' then lpad(p_year::text, 4, '0')
                                 else lpad((p_year % 100)::text, 2, '0') end);
  r := replace(r, '{DEPT}', p_dept);
  r := replace(r, '{CAT}', p_cat);
  r := replace(r, '{SEQ}', lpad(p_seq::text, p_seq_len, '0'));
  r := replace(r, '{REV}', lpad(p_rev::text, p_rev_len, '0'));
  r := replace(r, '{SEP}', p_sep);
  return r;
end $$;

-- =====================================================================
-- Atomic, concurrency-safe code generation
-- =====================================================================
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
    -- lock the chain root so concurrent revisions serialise
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

    -- row-level lock via UPSERT: concurrent callers queue on this row
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
    -- earlier revisions become 'revised'
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

-- admin only: cancel (records are never deleted)
create or replace function doc_code_gen_cancel_document(p_document_id uuid, p_reason text default null)
returns doc_code_gen_generated_documents language plpgsql security definer set search_path = public as $$
declare v_old doc_code_gen_generated_documents; v_new doc_code_gen_generated_documents;
begin
  if not doc_code_gen_is_admin() then raise exception 'Only administrators can cancel documents' using errcode = '42501'; end if;
  select * into v_old from doc_code_gen_generated_documents where id = p_document_id for update;
  if not found then raise exception 'Document not found'; end if;
  update doc_code_gen_generated_documents set status = 'cancelled',
    remarks = coalesce(remarks || E'\n', '') || 'Cancelled: ' || coalesce(p_reason, 'no reason given')
    where id = p_document_id returning * into v_new;
  insert into doc_code_gen_audit_logs (user_id, action, table_name, record_id, old_values, new_values)
    values (auth.uid(), 'CANCEL', 'doc_code_gen_generated_documents', p_document_id::text, to_jsonb(v_old), to_jsonb(v_new));
  return v_new;
end $$;

-- =====================================================================
-- Integrity: generated records are immutable and undeletable
-- =====================================================================
create or replace function guard_generated_documents() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Generated documents cannot be deleted';
  end if;
  if new.document_code is distinct from old.document_code
     or new.sequence_number is distinct from old.sequence_number
     or new.revision_number is distinct from old.revision_number
     or new.company_code is distinct from old.company_code
     or new.document_year is distinct from old.document_year
     or new.department_id is distinct from old.department_id
     or new.category_id is distinct from old.category_id
     or new.applicant_id is distinct from old.applicant_id
     or new.generated_at is distinct from old.generated_at then
    raise exception 'Document code fields are immutable';
  end if;
  return new;
end $$;
create trigger guard_generated_documents before update or delete on doc_code_gen_generated_documents
  for each row execute function guard_generated_documents();

create or replace function guard_append_only() returns trigger language plpgsql as $$
begin raise exception '% is append-only', tg_table_name; end $$;
create trigger guard_audit before update or delete on doc_code_gen_audit_logs
  for each row execute function guard_append_only();
create trigger guard_revisions before update or delete on doc_code_gen_document_revisions
  for each row execute function guard_append_only();

-- Users cannot change their own role / status / department / employee ID via the API
create or replace function guard_profiles() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not doc_code_gen_is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status
       or new.department_id is distinct from old.department_id
       or new.employee_id is distinct from old.employee_id
       or new.email is distinct from old.email then
      raise exception 'Only administrators can change role, status, department, employee ID or email'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger guard_profiles before update on doc_code_gen_users
  for each row execute function guard_profiles();

-- generic audit trigger for configuration tables
create or replace function audit_row() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into doc_code_gen_audit_logs (user_id, action, table_name, record_id, old_values, new_values)
  values (auth.uid(), tg_op, tg_table_name,
          coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id', ''),
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger audit_departments after insert or update or delete on doc_code_gen_departments
  for each row execute function audit_row();
create trigger audit_categories after insert or update or delete on doc_code_gen_document_categories
  for each row execute function audit_row();
create trigger audit_profiles after insert or update or delete on doc_code_gen_users
  for each row execute function audit_row();
create trigger audit_company_settings after update on doc_code_gen_company_settings
  for each row execute function audit_row();

-- Create a user straight from SQL (run in the Supabase SQL editor). The first user created becomes admin.
--   select doc_code_gen_create_user('admin@rvce.com.sa', 'a-strong-password', 'Administrator');
create or replace function doc_code_gen_create_user(
  p_email text, p_password text, p_full_name text,
  p_role doc_code_gen_user_role default 'employee',
  p_employee_id text default null, p_department_code text default null
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_role doc_code_gen_user_role := p_role;
begin
  if length(p_password) < 10 then raise exception 'Password must be at least 10 characters'; end if;
  if not exists (select 1 from doc_code_gen_users) then v_role := 'admin'; end if;
  insert into doc_code_gen_users (full_name, email, role, employee_id, department_id)
  values (p_full_name, lower(trim(p_email)), v_role, nullif(p_employee_id, ''),
          (select id from doc_code_gen_departments where department_code = upper(p_department_code)))
  returning id into v_id;
  insert into doc_code_gen_user_credentials (user_id, password_hash)
  values (v_id, crypt(p_password, gen_salt('bf', 10)));
  return v_id;
end $$;

-- =====================================================================
-- Dashboard analytics (SECURITY INVOKER: RLS scopes rows per role)
-- =====================================================================
create or replace function doc_code_gen_dashboard_stats(
  p_from date default null, p_to date default null, p_department_id uuid default null)
returns jsonb language sql stable security invoker set search_path = public as $$
with d as (
  select g.* from doc_code_gen_generated_documents g
  where (p_from is null or g.generated_at >= p_from)
    and (p_to is null or g.generated_at < p_to + 1)
    and (p_department_id is null or g.department_id = p_department_id)
)
select jsonb_build_object(
  'total', (select count(*) from d),
  'today', (select count(*) from d where generated_at::date = current_date),
  'month', (select count(*) from d where date_trunc('month', generated_at) = date_trunc('month', now())),
  'departments', (select count(*) from doc_code_gen_departments where status = 'active'),
  'users', (select count(*) from doc_code_gen_users where status = 'active'),
  'revised', (select count(*) from d where revision_number > 0),
  'by_department', coalesce((select jsonb_agg(jsonb_build_object('name', dp.department_name, 'value', c.n) order by c.n desc)
      from (select department_id, count(*) n from d group by 1) c
      join doc_code_gen_departments dp on dp.id = c.department_id), '[]'),
  'by_category', coalesce((select jsonb_agg(jsonb_build_object('name', ct.category_name, 'value', c.n) order by c.n desc)
      from (select category_id, count(*) n from d group by 1) c
      join doc_code_gen_document_categories ct on ct.id = c.category_id), '[]'),
  'monthly', coalesce((select jsonb_agg(jsonb_build_object('name', to_char(ms.m, 'Mon YY'), 'value', x.n) order by ms.m)
      from (select gs as m from generate_series(date_trunc('month', now()) - interval '11 months',
                                                date_trunc('month', now()), interval '1 month') gs) ms
      cross join lateral (select count(*) n from d where date_trunc('month', d.generated_at) = ms.m) x), '[]'),
  'top_users', coalesce((select jsonb_agg(jsonb_build_object('name', applicant_name, 'value', n) order by n desc)
      from (select applicant_name, count(*) n from d group by 1 order by 2 desc limit 5) t), '[]'),
  'revisions', coalesce((select jsonb_agg(jsonb_build_object('name', 'Rev ' || lpad(revision_number::text, 2, '0'), 'value', n)
                                          order by revision_number)
      from (select revision_number, count(*) n from d group by 1) t), '[]')
)
$$;

-- department document counts for Settings
create or replace view doc_code_gen_department_counts with (security_invoker = true) as
  select department_id, count(*)::int as total from doc_code_gen_generated_documents group by department_id;
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
insert into doc_code_gen_departments (department_name, department_code) values
  ('Operations','O'),('Engineering','E'),('Procurement','P'),('Finance','F'),
  ('Human Resources','H'),('Information Technology','IT'),('Projects','PR'),
  ('Administration','A'),('Quality & Safety','QS')
on conflict do nothing;

insert into doc_code_gen_document_categories (category_name, category_code) values
  ('Forms','F'),('Reports','R'),('Letters','L'),('Procedures','PR'),('Policies','PL'),
  ('Manuals','M'),('Drawings','D'),('Specifications','S'),('Correspondence','C')
on conflict do nothing;

-- =====================================================================
-- ADMIN USER (other users are added by the admin in Settings > Users)
-- CHANGE THIS PASSWORD after first login (Settings > Users > reset access).
-- =====================================================================
select doc_code_gen_create_user('it.support@rvce.com.sa', 'ChangeMe-Admin-2026', 'IT Support', 'admin', 'EMP-000', 'IT');

select email, role, status from doc_code_gen_users order by created_at;
