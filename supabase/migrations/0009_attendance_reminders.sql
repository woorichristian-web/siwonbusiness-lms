-- =====================================================================
-- 0009: Attendance tracking + 24-hour automatic reminders
-- =====================================================================

-- =====================================================================
-- 1) Attendance table
-- =====================================================================
create table if not exists public.attendance (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid unique not null references public.bookings(id) on delete cascade,
  status     text not null check (status in ('present', 'absent', 'late')),
  marked_at  timestamptz not null default now(),
  marked_by  uuid references public.profiles(id),
  notes      text
);

create index if not exists attendance_booking_idx on public.attendance(booking_id);

alter table public.attendance enable row level security;

-- Teacher manages attendance for their own slots
drop policy if exists attendance_teacher_manage on public.attendance;
create policy attendance_teacher_manage on public.attendance
  for all
  using (
    exists (
      select 1 from public.bookings b
      join public.time_slots ts on b.slot_id = ts.id
      where b.id = attendance.booking_id and ts.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.bookings b
      join public.time_slots ts on b.slot_id = ts.id
      where b.id = attendance.booking_id and ts.teacher_id = auth.uid()
    )
  );

-- Student reads own attendance
drop policy if exists attendance_student_read on public.attendance;
create policy attendance_student_read on public.attendance
  for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = attendance.booking_id and b.student_id = auth.uid()
    )
  );

-- Admin: full access
drop policy if exists attendance_admin_all on public.attendance;
create policy attendance_admin_all on public.attendance
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- 2) Reminder tracking on bookings (avoid duplicate sends)
-- =====================================================================
alter table public.bookings
  add column if not exists reminder_sent_at timestamptz;

-- =====================================================================
-- 3) 24-hour reminder function
-- =====================================================================
create or replace function public.send_24h_reminders()
returns void
language plpgsql
security definer
as $$
declare
  rec record;
  msg_body text;
begin
  for rec in
    select b.id as booking_id, b.student_id, b.start_at,
           ts.teacher_id, tp.name as teacher_name
      from public.bookings b
      join public.time_slots ts on b.slot_id = ts.id
      join public.profiles tp on ts.teacher_id = tp.id
     where b.status = 'confirmed'
       and b.reminder_sent_at is null
       and b.start_at between now() + interval '23 hours' and now() + interval '25 hours'
  loop
    msg_body := '[수업 24시간 전 알림] ' || rec.teacher_name || ' 강사님과 '
             || to_char(rec.start_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI')
             || ' 수업이 예정되어 있습니다. 준비 부탁드립니다.';

    insert into public.messages (sender_id, recipient_id, body)
    values (rec.teacher_id, rec.student_id, msg_body);

    update public.bookings set reminder_sent_at = now() where id = rec.booking_id;
  end loop;
end $$;

-- =====================================================================
-- 4) Enable pg_cron + schedule the reminder (Supabase 무료 플랜도 지원)
-- =====================================================================
do $$
begin
  -- Enable extension (idempotent)
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron 확장을 활성화하지 못했습니다: %', sqlerrm;
    return;
  end;

  -- Remove existing schedule (if any) before re-adding
  begin
    perform cron.unschedule('send-24h-reminders');
  exception when others then null;
  end;

  -- Schedule hourly (UTC). Window is 23-25 hours so even hourly cron catches every booking.
  begin
    perform cron.schedule(
      'send-24h-reminders',
      '0 * * * *',
      'select public.send_24h_reminders()'
    );
    raise notice '✅ 24시간 알림 스케줄 등록 완료 (매시 정각 UTC)';
  exception when others then
    raise notice '⚠️ cron 스케줄 등록 실패: %', sqlerrm;
  end;
end $$;
