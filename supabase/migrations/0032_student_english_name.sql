-- 0032: 교육생 영문 이름
-- 입력 시 강사 화면에는 영문 이름이 기본 표시되고, 없으면 한글 이름이 표시된다.
alter table public.profiles add column if not exists english_name text;
