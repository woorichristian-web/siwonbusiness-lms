-- 0030: 수업 형태 4종(1:1 수업 / 1:1 Coaching / Group 수업 / Group Coaching) + 과정별 클래스 수
-- 기존 'small_group' 값은 레거시로 계속 허용 (화면에는 Group 수업으로 표시)

-- time_slots.class_type (0001에서 '1on1','small_group'만 허용하던 제약 확장)
alter table public.time_slots drop constraint if exists time_slots_class_type_check;
alter table public.time_slots add constraint time_slots_class_type_check
  check (class_type in ('1on1','1on1_coaching','group','group_coaching','small_group'));

-- courses.class_type (0024 제약 확장)
alter table public.courses drop constraint if exists courses_class_type_check;
alter table public.courses add constraint courses_class_type_check
  check (class_type is null or class_type in ('1on1','1on1_coaching','group','group_coaching','small_group'));

-- 과정 생성 시 반(Class) 개수 — 이 수만큼 강사를 배정
alter table public.courses add column if not exists class_count integer;
