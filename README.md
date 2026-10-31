# Unique Numbering Portal | Document Code Generator

Next.js (App Router) + TypeScript + Tailwind + Supabase Postgres. Employees generate unique document codes such as `RVCC26-O-F-001-00`; every code is issued by a PostgreSQL function, never by the browser.

## Setup

1. Create a Supabase project.
2. In the SQL editor run, in order: `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_seed.sql`.
   If you ran the earlier unprefixed version, run `0000_cleanup_old.sql` first.
3. Copy `.env.example` to `.env.local` and fill in the URL, anon key, service-role key and **JWT secret** (Project Settings > API).
4. Create the first admin in the SQL editor (the first user created is always admin):
   ```sql
   select doc_code_gen_create_user('admin@yourco.com', 'a-strong-password', 'Administrator');
   ```
5. `npm install && npm run dev`, then sign in at http://localhost:3000.
   Add other users under Settings > Users, or with the same SQL function (optional args: role, employee id, department code).

## Tables

Everything is prefixed `doc_code_gen_`: `users`, `user_credentials` (bcrypt hashes, server only), `departments`, `document_categories`, `company_settings`, `document_sequences`, `generated_documents`, `document_revisions`, `audit_logs`.

## Authentication

Users and password hashes live in the database (not Supabase Auth). At login the server checks the bcrypt hash and issues an HttpOnly cookie holding a JWT signed with the project JWT secret. Supabase accepts it as an authenticated user, so RLS (`auth.uid()`) works unchanged. Deactivating a user or resetting access bumps `session_version`, which signs them out. Login is throttled to 5 failures per 15 minutes per server instance; add Cloudflare rate limiting on `/login` for a global limit.

## How numbering works

- `doc_code_gen_generate_code()` (SECURITY DEFINER) upserts the counter row in `document_sequences` (`INSERT … ON CONFLICT DO UPDATE last_sequence + 1`). The row lock serialises concurrent callers and the document is inserted in the same transaction: no duplicates, no gaps.
- Counters are separate per company + year + department + category; the reset rule (yearly/never) is configurable.
- `document_code` is `UNIQUE`; a second constraint stops duplicate revision numbers per original.
- Revisions reuse the original's company/year/department/category/sequence and bump only the revision part. The chain root is row-locked; earlier versions become `revised`.
- The format is a template in `company_settings.numbering_format` using `{COMPANY} {YEAR} {DEPT} {CAT} {SEQ} {REV} {SEP}`. Settings requires `{COMPANY} {DEPT} {CAT} {SEQ} {REV}` so codes cannot collide. `lib/numbering.ts` is preview only; `doc_code_gen_build_code()` is authoritative.

## Security model

- RLS on every table. Client roles have **no INSERT/UPDATE/DELETE on generated documents, sequences, revisions or audit logs**; writes happen only through `doc_code_gen_generate_code` / `doc_code_gen_cancel_document`. `user_credentials` has RLS on and no grants at all.
- Triggers make code fields immutable, block deletes, and make audit/revision tables append-only. Non-admins cannot change their own role, status, department or employee ID.
- Employees see only their own records; management and admin see all; only admins change configuration.
- The service-role key and JWT secret are server-only. The service-role client is used to read/write credentials and validate sessions.
- CSV export neutralises spreadsheet formulas; history filters strip PostgREST/LIKE metacharacters.

## Features

Generator (revision support; result panel with copy, PDF, print), History (search, filters, sort, paging, CSV/Excel export, detail page with revision chain and admin audit), Settings (company, numbering with live preview, departments, categories, users, audit log), Dashboard (KPIs, charts, date/department filters), Help, optional recipient email (Resend or SMTP), Sentry (`NEXT_PUBLIC_SENTRY_DSN`). Admins can cancel (never delete) a document.

## Deployment

Vercel or Cloudflare (OpenNext): set every variable from `.env.example`, keeping the service-role key and JWT secret server-side. Proxy the domain through Cloudflare and rate-limit `/login`. Run `npm run build` before release.

## Notes

- Company logo is a URL (no upload bucket).
- "Excel export" is UTF-8 CSV with BOM, which Excel opens directly.
- The SQL (concurrency, RLS) has not been run against a live database here. After applying the migrations, smoke-test: generate from two sessions at once, and try a direct insert into `doc_code_gen_generated_documents` as an employee (it must be rejected).
