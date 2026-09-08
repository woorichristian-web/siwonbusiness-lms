-- =====================================================================
-- 0039: 기업 담당자 역할(company) 추가
--  과정 생성 시 회사별 마스터 계정({회사약자}_master)이 자동 생성되며,
--  이 계정은 자기 회사의 교육 현황만 읽기 전용으로 열람한다.
-- =====================================================================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student','teacher','admin','company'));
