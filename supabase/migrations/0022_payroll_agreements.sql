-- =====================================================================
-- 0022: 강사 월별 정산 동의(Agree) 기록
-- 강사가 마이페이지 Payroll 에서 월별 정산 내역을 확인하고 "Agree" 를
-- 누르면 (teacher_id, period=YYYY-MM) 로 저장된다.
-- =====================================================================

create table if not exists public.payroll_agreements (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  period     text not null,               -- 'YYYY-MM'
  agreed_at  timestamptz not null default now(),
  unique (teacher_id, period)
);

alter table public.payroll_agreements enable row level security;

-- 본인 강사 + 관리자만 조회
drop policy if exists pa_select on public.payroll_agreements;
create policy pa_select on public.payroll_agreements
  for select using (teacher_id = auth.uid() or public.is_admin());

-- 본인만 동의(insert)
drop policy if exists pa_insert on public.payroll_agreements;
create policy pa_insert on public.payroll_agreements
  for insert with check (teacher_id = auth.uid());

-- 본인만 동의 취소(delete)
drop policy if exists pa_delete on public.payroll_agreements;
create policy pa_delete on public.payroll_agreements
  for delete using (teacher_id = auth.uid());
