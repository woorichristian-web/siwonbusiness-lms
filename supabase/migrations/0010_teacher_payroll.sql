-- =====================================================================
-- 0010: Teacher payroll info (bank account + hourly rate)
-- =====================================================================

alter table public.teachers
  add column if not exists bank_name      text,
  add column if not exists bank_account   text,
  add column if not exists account_holder text;

-- hourly_rate already exists from 0001 schema (default null). No change needed.

-- RLS: teachers can read/update their own row; admin can do all.
-- Existing policies cover this (from 0001: teachers_select_all + teachers_modify_own).
