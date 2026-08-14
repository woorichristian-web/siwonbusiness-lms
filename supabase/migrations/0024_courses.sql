-- =====================================================================
-- 0024: 과정(course) 엔티티 — 센터 허브
--   courses            : 과정 (강좌코드·명·회사·언어·형태·기간·요일/시간 등)
--   course_teachers    : 과정↔강사 (다중 배정 + 교체 이력 보존)
--   course_students    : 과정↔교육생
--   time_slots/bookings 에 course_id 연결
-- =====================================================================

create table if not exists public.courses (
  id            uuid primary key default gen_random_uuid(),
  code          text,                         -- 강좌코드
  name          text not null,                -- 강좌명
  company_name  text,
  language      text,
  format        text check (format in ('online','offline')),
  class_type    text check (class_type in ('1on1','small_group')),
  capacity      int,
  start_date    date,
  end_date      date,
  weekdays      text[] not null default '{}', -- 예: {tue,thu}
  class_time    text,                         -- 'HH:mm' (KST)
  duration_min  int,
  total_sessions int,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 과정↔강사 (여러 명 배정 가능, 교체 시 기존 배정은 종료 처리해 이력 보존)
create table if not exists public.course_teachers (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses(id) on delete cascade,
  teacher_id    uuid not null references public.profiles(id) on delete cascade,
  assigned_from date not null default current_date,
  assigned_until date,                        -- null = 현재 배정 중
  is_active     boolean not null default true,
  replaced_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists course_teachers_course_idx on public.course_teachers(course_id);
create index if not exists course_teachers_teacher_idx on public.course_teachers(teacher_id);

create table if not exists public.course_students (
  course_id   uuid not null references public.courses(id) on delete cascade,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (course_id, student_id)
);
create index if not exists course_students_student_idx on public.course_students(student_id);

alter table public.time_slots add column if not exists course_id uuid references public.courses(id) on delete set null;
alter table public.bookings   add column if not exists course_id uuid references public.courses(id) on delete set null;

-- RLS
alter table public.courses enable row level security;
alter table public.course_teachers enable row level security;
alter table public.course_students enable row level security;

-- 참여 판별 헬퍼 (재귀 방지)
create or replace function public.is_course_member(cid uuid)
returns boolean language sql security definer stable as $$
  select public.is_admin()
      or exists(select 1 from public.course_teachers ct where ct.course_id = cid and ct.teacher_id = auth.uid())
      or exists(select 1 from public.course_students cs where cs.course_id = cid and cs.student_id = auth.uid());
$$;

drop policy if exists courses_admin_all on public.courses;
create policy courses_admin_all on public.courses for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists courses_member_read on public.courses;
create policy courses_member_read on public.courses for select
  using (public.is_course_member(id));

drop policy if exists ct_admin_all on public.course_teachers;
create policy ct_admin_all on public.course_teachers for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists ct_member_read on public.course_teachers;
create policy ct_member_read on public.course_teachers for select
  using (public.is_course_member(course_id));

drop policy if exists cs_admin_all on public.course_students;
create policy cs_admin_all on public.course_students for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists cs_member_read on public.course_students;
create policy cs_member_read on public.course_students for select
  using (public.is_course_member(course_id));
