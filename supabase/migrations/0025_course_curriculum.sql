-- =====================================================================
-- 0025: 과정 커리큘럼 (강사가 엑셀로 업로드 → 센터·강사·교육생에게 표시)
-- =====================================================================

create table if not exists public.course_curriculum (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses(id) on delete cascade,
  session_no   int,             -- 차시
  session_date date,            -- 날짜 (선택)
  topic        text,            -- 주제
  details      text,            -- 세부 내용
  materials    text,            -- 자료/과제
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists course_curriculum_course_idx
  on public.course_curriculum(course_id, sort_order);

-- 과정에 커리큘럼 최종 갱신 시각 (재업로드 알림용)
alter table public.courses
  add column if not exists curriculum_updated_at timestamptz;

alter table public.course_curriculum enable row level security;

-- 관리자 전체 / 강사(담당)·교육생(수강) 조회
drop policy if exists cc_admin_all on public.course_curriculum;
create policy cc_admin_all on public.course_curriculum for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists cc_member_read on public.course_curriculum;
create policy cc_member_read on public.course_curriculum for select
  using (public.is_course_member(course_id));

-- 담당 강사는 자기 과정 커리큘럼을 업로드(insert/delete)할 수 있음
drop policy if exists cc_teacher_write on public.course_curriculum;
create policy cc_teacher_write on public.course_curriculum for insert
  with check (exists (
    select 1 from public.course_teachers ct
    where ct.course_id = course_curriculum.course_id
      and ct.teacher_id = auth.uid() and ct.assigned_until is null
  ));
drop policy if exists cc_teacher_delete on public.course_curriculum;
create policy cc_teacher_delete on public.course_curriculum for delete
  using (exists (
    select 1 from public.course_teachers ct
    where ct.course_id = course_curriculum.course_id
      and ct.teacher_id = auth.uid() and ct.assigned_until is null
  ));
