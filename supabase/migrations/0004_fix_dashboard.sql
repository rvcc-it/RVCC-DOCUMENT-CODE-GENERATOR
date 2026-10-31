-- Patch: fixes the Departments tile on the dashboard. Safe to run on an existing database.
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
grant execute on function doc_code_gen_dashboard_stats(date,date,uuid) to authenticated;
