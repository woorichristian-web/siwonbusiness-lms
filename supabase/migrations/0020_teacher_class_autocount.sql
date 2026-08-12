-- =====================================================================
-- 0020: teachers.number_of_classes 자동 집계
-- 강사가 실제로 진행한 수업 수 = 출석체크가 된 "수업 세션(time_slot)" 수.
--   · 세션 단위로 카운트 (소그룹 6명 = 1개 수업)
--   · 최소 1명이라도 출석 기록이 있고, 그게 'reschedule'(일정변경, 미진행)만은
--     아닌 슬롯을 진행된 수업으로 본다.
-- attendance 가 insert/update/delete 될 때마다 트리거로 자동 재계산된다.
-- =====================================================================

-- 특정 강사의 진행 수업 수를 재계산해 teachers 에 반영
create or replace function public.recount_teacher_classes(p_teacher uuid)
returns void language sql as $$
  update public.teachers t
  set number_of_classes = (
    select count(distinct ts.id)
    from public.time_slots ts
    join public.bookings b   on b.slot_id = ts.id
    join public.attendance a on a.booking_id = b.id
    where ts.teacher_id = p_teacher
      and a.status <> 'reschedule'
  )
  where t.profile_id = p_teacher;
$$;

-- attendance 변경 → 해당 강사 재계산
create or replace function public.trg_attendance_recount()
returns trigger language plpgsql as $$
declare
  v_teacher uuid;
begin
  select ts.teacher_id into v_teacher
  from public.bookings b
  join public.time_slots ts on ts.id = b.slot_id
  where b.id = coalesce(NEW.booking_id, OLD.booking_id);

  if v_teacher is not null then
    perform public.recount_teacher_classes(v_teacher);
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists attendance_recount on public.attendance;
create trigger attendance_recount
  after insert or update or delete on public.attendance
  for each row execute function public.trg_attendance_recount();

-- 최초 1회 전체 백필 (현재 값 계산)
update public.teachers t
set number_of_classes = (
  select count(distinct ts.id)
  from public.time_slots ts
  join public.bookings b   on b.slot_id = ts.id
  join public.attendance a on a.booking_id = b.id
  where ts.teacher_id = t.profile_id
    and a.status <> 'reschedule'
);
