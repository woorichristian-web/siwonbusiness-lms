-- =====================================================================
-- 0027: 교육생 → 강사 만족도 설문 (과정 10% / 50% / 종료일, 3회)
-- 응답 기간: 각 배포 시점부터 7일. 마감 후 강사에게 익명 취합 전달.
-- 익명성: 강사는 이 테이블을 직접 조회할 수 없음(집계는 서버에서 admin
-- 클라이언트로 수행). 학생은 본인 응답만 읽고 쓸 수 있음.
-- =====================================================================

create table if not exists public.survey_responses (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  round       int  not null check (round in (1, 2, 3)),
  rating      int  not null check (rating between 1 and 10),
  comment     text,
  comment_en  text,   -- 영문 번역 (저장 시 자동 번역)
  created_at  timestamptz not null default now(),
  unique (course_id, student_id, round)
);
create index if not exists survey_responses_course_idx
  on public.survey_responses(course_id, round);

alter table public.survey_responses enable row level security;

drop policy if exists sv_admin_all on public.survey_responses;
create policy sv_admin_all on public.survey_responses
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists sv_student_own on public.survey_responses;
create policy sv_student_own on public.survey_responses
  for select using (student_id = auth.uid());

drop policy if exists sv_student_insert on public.survey_responses;
create policy sv_student_insert on public.survey_responses
  for insert with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.course_students cs
      where cs.course_id = survey_responses.course_id
        and cs.student_id = auth.uid()
    )
  );
