-- =====================================================================
-- 0038: 자료실 (관리자 전용 게시판)
--  - board_posts: 게시글 (제목·본문·첨부 메타)
--  - storage 'board' 버킷 (비공개) — 관리자만 업로드/다운로드/삭제
-- =====================================================================

create table if not exists public.board_posts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  author_id   uuid references public.profiles(id) on delete set null,
  -- [{ path, name, size }]
  attachments jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.board_posts enable row level security;

drop policy if exists board_admin_all on public.board_posts;
create policy board_admin_all on public.board_posts
  for all using (public.is_admin()) with check (public.is_admin());

-- 비공개 스토리지 버킷
insert into storage.buckets (id, name, public)
values ('board', 'board', false)
on conflict (id) do nothing;

drop policy if exists board_storage_admin on storage.objects;
create policy board_storage_admin on storage.objects
  for all using (bucket_id = 'board' and public.is_admin())
  with check (bucket_id = 'board' and public.is_admin());
