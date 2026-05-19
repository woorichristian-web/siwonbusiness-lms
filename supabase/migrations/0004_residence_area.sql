-- =====================================================================
-- Siwon LMS — 교육생 주거지역 컬럼 추가
-- =====================================================================

alter table public.profiles
  add column if not exists residence_area text;
