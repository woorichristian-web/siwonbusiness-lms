import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import ConversationView from "@/components/ConversationView";

export const dynamic = "force-dynamic";

export default async function ChatRoomPage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await requireRole(["student", "teacher", "admin"]);
  const supabase = createClient();

  // RLS: 참여자가 아니면 conv 이 null 로 온다
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, title, course_name")
    .eq("id", params.id)
    .maybeSingle();

  if (!conv) {
    return (
      <>
        <AppHeader profile={profile} />
        <main className="mx-auto max-w-3xl px-4 py-10 text-center">
          <p className="text-sm text-slate-500">
            대화방을 찾을 수 없거나 접근 권한이 없습니다.
          </p>
          <Link href="/chat" className="mt-3 inline-block text-sm text-brand-700 underline">
            ← 대화방 목록
          </Link>
        </main>
      </>
    );
  }

  const { data: parts } = await supabase
    .from("conversation_participants")
    .select("profile_id")
    .eq("conversation_id", conv.id);
  const partIds = (parts ?? []).map((p) => p.profile_id);

  const { data: people } = partIds.length
    ? await supabase
        .from("profiles")
        .select("id, name, username, role")
        .in("id", partIds)
    : { data: [] as any[] };

  const { data: msgs } = await supabase
    .from("conversation_messages")
    .select("id, sender_id, body, attachment_path, attachment_name, attachment_type, created_at")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: true });

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col px-4 py-4">
        <ConversationView
          conversationId={conv.id}
          title={conv.title}
          meId={profile.id}
          meRole={profile.role}
          participants={(people ?? []) as any}
          initialMessages={(msgs ?? []) as any}
        />
      </main>
    </>
  );
}
