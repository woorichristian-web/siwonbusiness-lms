-- =====================================================================
-- 0012: Per-class feedback (10 leaf-level ratings + free-form comment)
--
-- Structure (only leaf categories are scored):
--   Language
--     Grammar          → accuracy, complexity
--     Vocabulary       → diversity, relevancy
--     Comprehension    (single score)
--     Content & Message → clarity, organization
--   Attitude
--     Participation, Tone & Manner, Preparation
--
-- Each leaf is rated 1-5 (one star = one point).
-- =====================================================================

create table if not exists public.feedback (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid unique not null references public.bookings(id) on delete cascade,

  -- Language > Grammar
  grammar_accuracy      int check (grammar_accuracy      between 1 and 5),
  grammar_complexity    int check (grammar_complexity    between 1 and 5),

  -- Language > Vocabulary
  vocabulary_diversity  int check (vocabulary_diversity  between 1 and 5),
  vocabulary_relevancy  int check (vocabulary_relevancy  between 1 and 5),

  -- Language > Comprehension
  comprehension         int check (comprehension         between 1 and 5),

  -- Language > Content & Message
  content_clarity       int check (content_clarity       between 1 and 5),
  content_organization  int check (content_organization  between 1 and 5),

  -- Attitude
  participation         int check (participation         between 1 and 5),
  tone_manner           int check (tone_manner           between 1 and 5),
  preparation           int check (preparation           between 1 and 5),

  comment               text,
  created_by            uuid references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists feedback_booking_idx on public.feedback(booking_id);

-- updated_at 자동 갱신
drop trigger if exists feedback_set_updated_at on public.feedback;
create trigger feedback_set_updated_at
  before update on public.feedback
  for each row execute function public.set_updated_at();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.feedback enable row level security;

-- Teacher manages feedback for their own bookings
drop policy if exists feedback_teacher_manage on public.feedback;
create policy feedback_teacher_manage on public.feedback
  for all
  using (
    exists (
      select 1 from public.bookings b
      join public.time_slots ts on b.slot_id = ts.id
      where b.id = feedback.booking_id and ts.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.bookings b
      join public.time_slots ts on b.slot_id = ts.id
      where b.id = feedback.booking_id and ts.teacher_id = auth.uid()
    )
  );

-- Student reads own feedback
drop policy if exists feedback_student_read on public.feedback;
create policy feedback_student_read on public.feedback
  for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = feedback.booking_id and b.student_id = auth.uid()
    )
  );

-- Admin full access
drop policy if exists feedback_admin on public.feedback;
create policy feedback_admin on public.feedback
  for all
  using (public.is_admin())
  with check (public.is_admin());
