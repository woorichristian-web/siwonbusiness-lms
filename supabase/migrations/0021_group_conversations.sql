-- =====================================================================
-- 0021: 그룹 대화방 (강사 ↔ 교육생 다대다) + 파일/이미지/음성 첨부
--   conversations            : 대화방 (제목 = 강좌명)
--   conversation_participants: 참여자 (강사 + 교육생들)
--   conversation_messages    : 메시지 (텍스트 + 선택적 첨부파일)
--   storage bucket 'chat'    : 첨부파일 저장 (비공개, 참여자만 접근)
-- =====================================================================

create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,                 -- 강좌명
  course_name text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);
create index if not exists conv_part_profile_idx on public.conversation_participants(profile_id);

create table if not exists public.conversation_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text,                        -- 텍스트 (첨부만 있을 땐 null 가능)
  attachment_path text,                        -- storage 경로 (chat 버킷)
  attachment_name text,                        -- 원본 파일명
  attachment_type text,                        -- MIME 타입
  created_at      timestamptz not null default now()
);
create index if not exists conv_msg_idx on public.conversation_messages(conversation_id, created_at);

-- 참여자 판별 헬퍼 (RLS 재귀 방지용 security definer)
create or replace function public.is_conv_participant(conv uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = conv and cp.profile_id = auth.uid()
  ) or public.is_admin();
$$;

-- RLS
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.conversation_messages enable row level security;

drop policy if exists conv_select on public.conversations;
create policy conv_select on public.conversations
  for select using (public.is_conv_participant(id));

drop policy if exists conv_insert on public.conversations;
create policy conv_insert on public.conversations
  for insert with check (
    created_by = auth.uid() and public.current_role() in ('teacher','admin')
  );

drop policy if exists conv_part_select on public.conversation_participants;
create policy conv_part_select on public.conversation_participants
  for select using (public.is_conv_participant(conversation_id));

drop policy if exists conv_part_insert on public.conversation_participants;
create policy conv_part_insert on public.conversation_participants
  for insert with check (public.current_role() in ('teacher','admin'));

drop policy if exists conv_msg_select on public.conversation_messages;
create policy conv_msg_select on public.conversation_messages
  for select using (public.is_conv_participant(conversation_id));

drop policy if exists conv_msg_insert on public.conversation_messages;
create policy conv_msg_insert on public.conversation_messages
  for insert with check (
    sender_id = auth.uid() and public.is_conv_participant(conversation_id)
  );

-- Realtime (새 메시지 실시간 수신)
do $$ begin
  begin alter publication supabase_realtime add table public.conversation_messages;
  exception when others then null; end;
end $$;

-- 첨부파일 저장 버킷 (비공개)
insert into storage.buckets (id, name, public)
values ('chat', 'chat', false)
on conflict (id) do nothing;

-- Storage 권한: 경로 첫 폴더 = conversation_id. 참여자만 읽기/업로드.
drop policy if exists chat_read on storage.objects;
create policy chat_read on storage.objects
  for select using (
    bucket_id = 'chat'
    and public.is_conv_participant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists chat_insert on storage.objects;
create policy chat_insert on storage.objects
  for insert with check (
    bucket_id = 'chat'
    and public.is_conv_participant(((storage.foldername(name))[1])::uuid)
  );
