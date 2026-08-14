-- =====================================================================
-- 0023: 수업후기 (학생 → 완료된 수업별 강사 후기)
-- 별점(1~5) + 선택 의견. 학생·해당 강사·관리자만 열람.
-- =====================================================================

create table if not exists public.class_reviews (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  slot_id    uuid not null references public.time_slots(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  rating     int check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, slot_id)
);
create index if not exists class_reviews_teacher_idx on public.class_reviews(teacher_id);

alter table public.class_reviews enable row level security;

drop policy if exists cr_select on public.class_reviews;
create policy cr_select on public.class_reviews
  for select using (
    student_id = auth.uid() or teacher_id = auth.uid() or public.is_admin()
  );

drop policy if exists cr_insert on public.class_reviews;
create policy cr_insert on public.class_reviews
  for insert with check (student_id = auth.uid());

drop policy if exists cr_update on public.class_reviews;
create policy cr_update on public.class_reviews
  for update using (student_id = auth.uid()) with check (student_id = auth.uid());
