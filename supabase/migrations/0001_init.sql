-- =====================================================================
-- Siwon LMS — initial schema
-- 실행 위치: Supabase SQL Editor (한 번만)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) profiles : 모든 사용자 공통 (auth.users 확장)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  role              text not null default 'student' check (role in ('student','teacher','admin')),
  username          text not null unique,
  name              text not null,
  birth_date        date,
  company_name      text,
  industry          text,
  job_role          text,
  learning_purpose  text,
  preferred_format  text[] default '{}',  -- ['online','offline','1on1','small_group']
  preferred_time    text[] default '{}',  -- ['early_morning','lunch','evening']
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists profiles_company_idx on public.profiles(company_name);
create index if not exists profiles_role_idx    on public.profiles(role);

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2) teachers : 강사 추가 정보
-- ---------------------------------------------------------------------
create table if not exists public.teachers (
  profile_id   uuid primary key references public.profiles(id) on delete cascade,
  bio          text,
  specialty    text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3) time_slots : 강사별 가능 시간
-- ---------------------------------------------------------------------
create table if not exists public.time_slots (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.profiles(id) on delete cascade,
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  format      text not null check (format in ('online','offline')),
  class_type  text not null check (class_type in ('1on1','small_group')),
  capacity    int  not null default 1,
  status      text not null default 'open' check (status in ('open','closed')),
  created_at  timestamptz not null default now(),
  check (end_at > start_at)
);

create index if not exists time_slots_teacher_idx on public.time_slots(teacher_id);
create index if not exists time_slots_start_idx   on public.time_slots(start_at);

-- ---------------------------------------------------------------------
-- 4) bookings : 학생 수강 신청
-- ---------------------------------------------------------------------
create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  slot_id       uuid not null references public.time_slots(id) on delete cascade,
  student_id    uuid not null references public.profiles(id)  on delete cascade,
  status        text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  created_at    timestamptz not null default now(),
  cancelled_at  timestamptz
);

-- 동일 학생이 동일 슬롯을 '확정' 상태로 중복 예약 못 하게
create unique index if not exists bookings_unique_confirmed
  on public.bookings(slot_id, student_id) where status = 'confirmed';

create index if not exists bookings_student_idx on public.bookings(student_id);
create index if not exists bookings_slot_idx    on public.bookings(slot_id);

-- =====================================================================
-- RLS (Row Level Security)
-- =====================================================================
alter table public.profiles   enable row level security;
alter table public.teachers   enable row level security;
alter table public.time_slots enable row level security;
alter table public.bookings   enable row level security;

-- 헬퍼: 현재 사용자가 관리자인지
create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.current_role()
returns text language sql stable security definer as $$
  select role from public.profiles where id = auth.uid()
$$;

-- profiles 정책
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id or public.is_admin());

-- teachers 정책 — 로그인한 누구나 조회, 본인/관리자만 수정
drop policy if exists teachers_select_all on public.teachers;
create policy teachers_select_all on public.teachers
  for select using (auth.role() = 'authenticated');

drop policy if exists teachers_modify_own on public.teachers;
create policy teachers_modify_own on public.teachers
  for all using (auth.uid() = profile_id or public.is_admin())
         with check (auth.uid() = profile_id or public.is_admin());

-- time_slots 정책 — 로그인한 누구나 조회, 강사 본인/관리자만 변경
drop policy if exists slots_select_all on public.time_slots;
create policy slots_select_all on public.time_slots
  for select using (auth.role() = 'authenticated');

drop policy if exists slots_modify_owner on public.time_slots;
create policy slots_modify_owner on public.time_slots
  for all using (auth.uid() = teacher_id or public.is_admin())
         with check (auth.uid() = teacher_id or public.is_admin());

-- bookings 정책
--   - 학생: 본인 booking만 조회/생성/취소
--   - 강사: 본인 슬롯에 들어온 booking 조회 가능
--   - 관리자: 전체
drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings
  for select using (
    auth.uid() = student_id
    or exists (
      select 1 from public.time_slots s
      where s.id = bookings.slot_id and s.teacher_id = auth.uid()
    )
    or public.is_admin()
  );

drop policy if exists bookings_insert_self on public.bookings;
create policy bookings_insert_self on public.bookings
  for insert with check (auth.uid() = student_id);

drop policy if exists bookings_update_self on public.bookings;
create policy bookings_update_self on public.bookings
  for update using (auth.uid() = student_id or public.is_admin());
