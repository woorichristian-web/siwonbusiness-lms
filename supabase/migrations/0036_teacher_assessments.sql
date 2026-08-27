-- 0036: 강사의 교육생 스피킹 평가 (Initial / Final Assessment)
-- 10개 영역(Delivery·Language Use·Content·Interaction) 점수 1~10을 jsonb로 저장.
-- 과정·학생·단계(initial/final)당 1행. 담당(활성 배정) 강사와 관리자만 접근.

create table if not exists public.teacher_assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  phase text not null check (phase in ('initial', 'final')),
  scores jsonb not null default '{}'::jsonb,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, student_id, phase)
);

alter table public.teacher_assessments enable row level security;

-- 해당 과정에 활성 배정된 강사: 읽기/쓰기 (강사 교체 시 새 강사가 이어서 수정 가능)
drop policy if exists "assessments_course_teacher_all" on public.teacher_assessments;
create policy "assessments_course_teacher_all" on public.teacher_assessments
  for all
  using (
    exists (
      select 1 from public.course_teachers ct
      where ct.course_id = teacher_assessments.course_id
        and ct.teacher_id = auth.uid()
        and ct.assigned_until is null
    )
  )
  with check (
    exists (
      select 1 from public.course_teachers ct
      where ct.course_id = teacher_assessments.course_id
        and ct.teacher_id = auth.uid()
        and ct.assigned_until is null
    )
  );

-- 관리자(센터): 전체
drop policy if exists "assessments_admin_all" on public.teacher_assessments;
create policy "assessments_admin_all" on public.teacher_assessments
  for all using (public.is_admin()) with check (public.is_admin());
