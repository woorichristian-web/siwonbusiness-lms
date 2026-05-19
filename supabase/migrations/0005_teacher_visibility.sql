-- =====================================================================
-- Allow all authenticated users to see teacher profiles (name only needed)
-- Without this, students/educatees can't see teacher names on their calendar.
-- =====================================================================

drop policy if exists profiles_select_teachers on public.profiles;
create policy profiles_select_teachers on public.profiles
  for select
  using (role = 'teacher' and auth.role() = 'authenticated');
