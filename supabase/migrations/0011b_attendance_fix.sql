-- =====================================================================
-- 0011b: Force-fix attendance.status check constraint
-- (drops ALL existing check constraints on the table, then re-adds the right one)
-- =====================================================================

do $$
declare
  c text;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.attendance'::regclass
       and contype = 'c'
  loop
    execute 'alter table public.attendance drop constraint ' || quote_ident(c);
  end loop;
end $$;

alter table public.attendance
  add constraint attendance_status_check
  check (status in ('present', 'late', 'absent', 'reschedule', 'other'));
