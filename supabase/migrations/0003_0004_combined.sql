-- =====================================================================
-- Combined migration 0003 + 0004 (clean ASCII version)
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS.
-- =====================================================================

-- 0003-1: Add phone, admin_notes, assigned_teacher_id, residence_area to profiles
alter table public.profiles
  add column if not exists phone               text,
  add column if not exists admin_notes         text,
  add column if not exists assigned_teacher_id uuid references public.profiles(id),
  add column if not exists residence_area      text;

create index if not exists profiles_assigned_teacher_idx
  on public.profiles(assigned_teacher_id);

-- 0003-2: Company settings table
create table if not exists public.company_settings (
  company_name        text primary key,
  allowed_class_types text[] not null default '{}',
  allowed_formats     text[] not null default '{}',
  allowed_teacher_ids uuid[] not null default '{}',
  total_sessions      int,
  updated_at          timestamptz not null default now()
);

-- 0003-3: Company holidays table
create table if not exists public.company_holidays (
  id           uuid primary key default gen_random_uuid(),
  company_name text not null,
  holiday_date date not null,
  reason       text,
  created_at   timestamptz not null default now(),
  unique (company_name, holiday_date)
);

create index if not exists company_holidays_company_idx
  on public.company_holidays(company_name);

-- 0003-4: RLS
alter table public.company_settings enable row level security;
alter table public.company_holidays enable row level security;

-- Drop old policies if any
drop policy if exists company_settings_admin on public.company_settings;
drop policy if exists company_settings_read  on public.company_settings;
drop policy if exists company_holidays_admin on public.company_holidays;
drop policy if exists company_holidays_read  on public.company_holidays;

-- Admin: full access
create policy company_settings_admin on public.company_settings
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy company_holidays_admin on public.company_holidays
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Authenticated users: read settings/holidays for their own company
create policy company_settings_read on public.company_settings
  for select
  using (
    auth.role() = 'authenticated'
    and company_name = (select company_name from public.profiles where id = auth.uid())
  );

create policy company_holidays_read on public.company_holidays
  for select
  using (
    auth.role() = 'authenticated'
    and company_name = (select company_name from public.profiles where id = auth.uid())
  );
