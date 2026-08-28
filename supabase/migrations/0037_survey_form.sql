-- =====================================================================
-- 0037: 만족도 조사 양식 개편 — 객관식 10문항(5점 척도) + 주관식 2문항
--  - answers      : {"q1":5, ... "q10":4} 문항별 점수
--  - strengths    : 주관식 1 (만족스러웠던 점)
--  - improvements : 주관식 2 (개선·추가 요청)
--  기존 rating 컬럼에는 10점 환산 평균이 계속 저장되어 이전 집계와 호환.
-- =====================================================================

alter table public.survey_responses
  add column if not exists answers      jsonb,
  add column if not exists strengths    text,
  add column if not exists improvements text;
