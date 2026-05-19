-- =====================================================================
-- Allow teachers to see profiles of students who have booked their classes
-- =====================================================================

drop policy if exists profiles_select_my_students on public.profiles;
create policy profiles_select_my_students on public.profiles
  for select
  using (
    exists (
      select 1
      from public.bookings b
      join public.time_slots ts on b.slot_id = ts.id
      where b.student_id = profiles.id
        and b.status = 'confirmed'
        and ts.teacher_id = auth.uid()
    )
  );
