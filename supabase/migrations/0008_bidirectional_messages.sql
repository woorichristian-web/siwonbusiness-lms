-- =====================================================================
-- 0008: Bidirectional messaging
--   - Anyone authenticated can send a message (student/teacher/admin)
--   - Students can see admin profiles (so they can message them)
-- =====================================================================

-- Allow anyone authenticated to insert a message they author themselves.
drop policy if exists messages_insert_authorized on public.messages;
create policy messages_insert_authorized on public.messages
  for insert
  with check (auth.uid() = sender_id);

-- Allow all authenticated users to see admin profiles (name/role).
-- Existing policies already cover teacher visibility (0005) and admins-see-all (0001).
drop policy if exists profiles_select_admins on public.profiles;
create policy profiles_select_admins on public.profiles
  for select
  using (role = 'admin' and auth.role() = 'authenticated');
