-- =====================================================================
-- 0016: Teacher meeting room URLs (Zoom / Teams)
-- Used as "Open in Zoom" / "Open in Teams" shortcut on class detail modals.
-- =====================================================================

alter table public.teachers
  add column if not exists zoom_url  text,
  add column if not exists teams_url text;
