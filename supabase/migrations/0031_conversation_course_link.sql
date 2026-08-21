-- 0031: 대화방 ↔ 과정·강사(반) 연결
-- 과정이 생성/수정되면 반(배정 강사)별 대화방을 자동 생성·동기화하기 위한 링크 컬럼.
-- 과정 삭제 시 대화방도 함께 삭제, 강사 해제 시 대화방은 유지(teacher_id 만 null).
alter table public.conversations
  add column if not exists course_id uuid references public.courses(id) on delete cascade;
alter table public.conversations
  add column if not exists teacher_id uuid references public.profiles(id) on delete set null;
create unique index if not exists conversations_course_teacher_uniq
  on public.conversations(course_id, teacher_id)
  where course_id is not null and teacher_id is not null;
