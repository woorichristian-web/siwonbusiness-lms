-- =====================================================================
-- Siwon LMS — 기업별 관리 + 회원 연락처/특이사항/배정 강사
-- =====================================================================

-- 1) profiles 에 신규 컬럼
alter table public.profiles
  add column if not exists phone               text,
  add column if not exists admin_notes         text,
  add column if not exists assigned_teacher_id uuid references public.profiles(id);

create index if not exists profiles_assigned_teacher_idx
  on public.profiles(assigned_teacher_id);

-- 2) 기업별 설정 (과정/강사/차시)
create table if not exists public.company_settings (
  company_name        text primary key,
  allowed_class_types text[] not null default '{}',  -- 빈 배열 = 전부 허용
  allowed_formats     text[] not null default '{}',  -- 빈 배열 = 전부 허용
  allowed_teacher_ids uuid[] not null default '{}',  -- 빈 배열 = 전부 허용
  total_sessions      int,                            -- null = 무제한
  updated_at          timestamptz not null default now()
);

-- 3) 기업별 휴일
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

-- 4) RLS
alter table public.company_settings enable row level security;
alter table public.company_holidays enable row level security;

-- 관리자: 전부 CRUD
drop policy if exists company_settings_admin on public.company_settings;
create policy company_settings_admin on public.company_settings
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists company_holidays_admin on public.company_holidays;
create policy company_holidays_admin on public.company_holidays
  for all using (public.is_admin()) with check (public.is_admin());

-- 학생: 자기 소속 기업의 설정·휴일만 읽기
drop policy if exists company_settings_read on public.company_settings;
create policy company_settings_read on public.company_settings
  for select using (
    auth.role() = 'authenticated'
    and company_name = (select company_name from public.profiles where id = auth.uid())
  );

drop policy if exists company_holidays_read on public.company_holidays;
create policy company_holidays_read on public.company_holidays
  for select using (
    auth.role() = 'authenticated'
    and company_name = (select company_name from public.profiles where id = auth.uid())
  );
