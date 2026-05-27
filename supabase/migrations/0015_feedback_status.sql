-- =====================================================================
-- 0015: Feedback draft vs submitted
-- - draft : 임시저장. progress 리포트/평균 계산에서 제외
-- - submitted : 최종 제출
-- Existing rows are treated as submitted (default).
-- =====================================================================

alter table public.feedback
  add column if not exists status text not null default 'submitted'
  check (status in ('draft', 'submitted'));

create index if not exists feedback_status_idx on public.feedback(status);
