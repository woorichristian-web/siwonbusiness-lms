-- 0028: 과정에 교재명 추가
alter table public.courses add column if not exists textbook text;
