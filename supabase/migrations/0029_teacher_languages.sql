-- 0029: 강사 사용 언어 (쉼표 구분, 예: "English, Korean")
alter table public.teachers add column if not exists languages text;
