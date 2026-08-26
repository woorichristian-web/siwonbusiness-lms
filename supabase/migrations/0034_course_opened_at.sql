-- 0034: 과정 오픈 시각
-- [과정 오픈] 시 기록된다. 강사·교육생은 대화방에서 이 시각 이후의 메시지만 보게 되어
-- 테스트 기간에 주고받은 대화가 실배포 후 노출되지 않는다. (센터는 전체 열람)
alter table public.courses add column if not exists opened_at timestamptz;
