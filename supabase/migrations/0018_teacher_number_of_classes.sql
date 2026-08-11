-- =====================================================================
-- 0018: 강사 정보에 number_of_classes (담당 수업 수) 추가
--        + 누락돼 있던 hourly_rate 컬럼 보정
-- 강사 일괄 업로드 템플릿에 'number of classes' (I열) 이 추가된 것에 대응.
-- ※ hourly_rate 는 0010 마이그레이션 주석이 "0001 에 이미 있다" 고 잘못
--    가정했으나 실제 스키마(0001)에는 없어, 강사 업로드 시 teachers upsert
--    단계에서 컬럼 없음 오류가 발생했음. 여기서 함께 추가한다.
-- =====================================================================

alter table public.teachers
  add column if not exists hourly_rate       numeric,
  add column if not exists number_of_classes integer;

-- 기존 RLS 정책(teachers_select_all / teachers_modify_own)이 새 컬럼도 그대로
-- 커버하므로 추가 정책 변경 불필요.
