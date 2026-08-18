-- =====================================================================
-- 0026: 피드백 항목 개편 — Delivery(Pronunciation·Pace) 추가 + Attitude 를
--        Participation·Homework 로 변경 (tone_manner/preparation 은 미사용 보존)
-- 배점: Delivery 1+1, Grammar 1+1, Vocabulary 1+1, Comprehension 1,
--        Content 1+1, Attitude 0.5+0.5 = 총 10점. 별점(1~5) 입력.
-- =====================================================================

alter table public.feedback
  add column if not exists delivery_pronunciation int,
  add column if not exists delivery_pace          int,
  add column if not exists homework               int;

alter table public.feedback
  drop constraint if exists feedback_delivery_pronunciation_check,
  drop constraint if exists feedback_delivery_pace_check,
  drop constraint if exists feedback_homework_check;

alter table public.feedback
  add constraint feedback_delivery_pronunciation_check check (delivery_pronunciation between 1 and 5),
  add constraint feedback_delivery_pace_check          check (delivery_pace          between 1 and 5),
  add constraint feedback_homework_check               check (homework               between 1 and 5);
