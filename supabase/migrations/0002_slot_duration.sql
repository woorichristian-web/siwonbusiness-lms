-- =====================================================================
-- Siwon LMS — 슬롯 단위 예약 지원
-- 강사: 큰 가능 시간 블록(예: 09:00-12:00) 등록
-- 학생: 그 안을 slot_duration_minutes (30/60) 단위로 쪼개서 예약
-- =====================================================================

-- 1) time_slots 에 슬롯 길이 컬럼 추가
alter table public.time_slots
  add column if not exists slot_duration_minutes int not null default 60
  check (slot_duration_minutes in (30, 60));

-- 2) bookings 에 실제 예약된 시간 범위 컬럼 추가
alter table public.bookings
  add column if not exists start_at timestamptz,
  add column if not exists end_at   timestamptz;

-- 3) 동일 슬롯·학생·시작시각 조합 중복 예약 방지 (기존 인덱스 교체)
drop index if exists bookings_unique_confirmed;
create unique index bookings_unique_confirmed
  on public.bookings(slot_id, student_id, start_at)
  where status = 'confirmed';

create index if not exists bookings_start_idx on public.bookings(start_at);

-- 4) 기존 데이터(아직 start_at 가 null 인 row)는 백필.
-- 우리 환경에는 예약이 거의 없을 테니 안전하게 처리.
update public.bookings b
   set start_at = s.start_at,
       end_at   = s.start_at + (s.slot_duration_minutes * interval '1 minute')
  from public.time_slots s
 where b.slot_id = s.id and b.start_at is null;
