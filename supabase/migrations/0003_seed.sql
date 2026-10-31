insert into doc_code_gen_departments (department_name, department_code) values
  ('Operations','O'),('Engineering','E'),('Procurement','P'),('Finance','F'),
  ('Human Resources','H'),('Information Technology','IT'),('Projects','PR'),
  ('Administration','A'),('Quality & Safety','QS')
on conflict do nothing;

insert into doc_code_gen_document_categories (category_name, category_code) values
  ('Forms','F'),('Reports','R'),('Letters','L'),('Procedures','PR'),('Policies','PL'),
  ('Manuals','M'),('Drawings','D'),('Specifications','S'),('Correspondence','C')
on conflict do nothing;
