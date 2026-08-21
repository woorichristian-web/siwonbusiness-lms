-- 0033: 테스트 과정 플래그
-- 체크 시 센터(관리자) 화면에서만 보이고, 배정된 강사·교육생 화면 어디에도 노출되지 않는다.
alter table public.courses add column if not exists is_test boolean not null default false;
