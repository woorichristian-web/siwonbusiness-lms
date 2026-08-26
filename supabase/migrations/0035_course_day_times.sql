-- 0035: 과정 요일별 시작 시간
-- 예: {"mon":"10:00","tue":"09:00"} — 요일마다 다른 시작 시각을 지정할 수 있다.
-- 비어 있으면 기존 class_time(단일 시각)을 그대로 사용.
alter table public.courses add column if not exists day_times jsonb;
