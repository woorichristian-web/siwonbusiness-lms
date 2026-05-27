-- =====================================================================
-- 0014: Student → Teacher feedback
-- One feedback record per (student, teacher) pair. Updatable.
-- =====================================================================

create table if not exists public.student_teacher_feedback (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  teacher_id  uuid not null references public.profiles(id) on delete cascade,
  rating      int  check (rating between 1 and 10),
  comment     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (student_id, teacher_id)
);

create index if not exists stf_teacher_idx on public.student_teacher_feedback(teacher_id);

drop trigger if exists stf_set_updated_at on public.student_teacher_feedback;
create trigger stf_set_updated_at
  before update on public.student_teacher_feedback
  for each row execute function public.set_updated_at();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.student_teacher_feedback enable row level security;

-- Student manages own feedback (insert/update/delete)
drop policy if exists stf_student_manage on public.student_teacher_feedback;
create policy stf_student_manage on public.student_teacher_feedback
  for all
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- Teacher can read feedback about themselves
drop policy if exists stf_teacher_read on public.student_teacher_feedback;
create policy stf_teacher_read on public.student_teacher_feedback
  for select
  using (auth.uid() = teacher_id);

-- Admin full access
drop policy if exists stf_admin on public.student_teacher_feedback;
create policy stf_admin on public.student_teacher_feedback
  for all
  using (public.is_admin())
  with check (public.is_admin());
