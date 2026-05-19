-- =====================================================================
-- 0006: Enrollment course info on profiles + Messages table + Realtime
-- =====================================================================

-- Course (enrollment) info per student
alter table public.profiles
  add column if not exists course_name            text,
  add column if not exists course_start_date      date,
  add column if not exists course_end_date        date,
  add column if not exists course_total_sessions  int;

-- Messages table
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body         text not null,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists messages_recipient_idx
  on public.messages(recipient_id, created_at desc);

create index if not exists messages_unread_idx
  on public.messages(recipient_id) where read_at is null;

alter table public.messages enable row level security;

drop policy if exists messages_insert_authorized on public.messages;
create policy messages_insert_authorized on public.messages
  for insert
  with check (
    auth.uid() = sender_id
    and (
      public.is_admin()
      or public.current_role() in ('teacher', 'admin')
    )
  );

drop policy if exists messages_select_participants on public.messages;
create policy messages_select_participants on public.messages
  for select
  using (
    auth.uid() = recipient_id
    or auth.uid() = sender_id
    or public.is_admin()
  );

drop policy if exists messages_update_recipient on public.messages;
create policy messages_update_recipient on public.messages
  for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Enable Realtime so unread alerts can pop up on the client.
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when others then
    null; -- publication may not exist (self-hosted) or table already published
  end;
end $$;
