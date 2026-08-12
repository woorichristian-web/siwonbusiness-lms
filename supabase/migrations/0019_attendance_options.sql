-- =====================================================================
-- 0019: 출석 상태 옵션 개편
-- 신규 집합:
--   present, late_within_10, late_over_10,
--   absent, absent_business, reschedule, company_vacation
-- 기존 'late' / 'other' 는 제거(→ 매핑). late_over_10 은 "출석이지만 red flag"
-- 의미(출석 인정 + 경고 표시). absent_business / reschedule / company_vacation
-- 은 출석률 분모에서 제외된다(계산은 앱 코드에서 처리).
-- =====================================================================

-- 1) 기존 값 매핑 (현재 데이터엔 present 만 있어 사실상 no-op, 방어적 처리)
update public.attendance set status = 'late_within_10' where status = 'late';
update public.attendance set status = 'reschedule'     where status = 'other';

-- 2) CHECK 제약 교체
alter table public.attendance drop constraint if exists attendance_status_check;
alter table public.attendance
  add constraint attendance_status_check
  check (status in (
    'present',
    'late_within_10',
    'late_over_10',
    'absent',
    'absent_business',
    'reschedule',
    'company_vacation'
  ));
