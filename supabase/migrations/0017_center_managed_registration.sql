-- =====================================================================
-- 0017: company_settings.center_managed_registration
-- 기업(센터)이 학생 대신 수강신청을 직접 관리하는 경우의 플래그.
-- true 인 경우 교육생은 /student/register 에서 신청할 수 없고
-- "귀하의 수강신청은 귀사에서 대신합니다." 안내 표시.
-- =====================================================================

alter table public.company_settings
  add column if not exists center_managed_registration boolean not null default false;

-- 스키마 캐시 새로고침
notify pgrst, 'reload schema';
