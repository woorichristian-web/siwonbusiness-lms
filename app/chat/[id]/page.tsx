import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    .select("id, title, course_name, course_id")
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

  const [{ data: parts }, { data: msgsAll }] = await Promise.all([
    supabase
      .from("conversation_participants")
      .select("profile_id")
      .eq("conversation_id", conv.id),
    supabase
      .from("conversation_messages")
      .select("id, sender_id, body, attachment_path, attachment_name, attachment_type, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true }),
  ]);
  const partIds = (parts ?? []).map((p) => p.profile_id);

  // 테스트 기간 대화 숨김 — 과정이 [과정 오픈]된 경우, 강사·교육생에게는
  // 오픈 시각 이후의 메시지만 보여준다 (테스트 중 주고받은 기록 비노출).
  // 센터(관리자)는 전체 열람 가능. opened_at 컬럼 미적용(0034 전)이면 필터 없음.
  let msgs = msgsAll ?? [];
  if (profile.role !== "admin" && (conv as any).course_id) {
    const { data: courseRow } = await supabase
      .from("courses")
      .select("opened_at")
      .eq("id", (conv as any).course_id)
      .maybeSingle();
    const openedAt = (courseRow as any)?.opened_at as string | null | undefined;
    if (openedAt) {
      const t = new Date(openedAt).getTime();
      msgs = msgs.filter((m: any) => new Date(m.created_at).getTime() >= t);
    }
  }

  // 발신자에는 참여자가 아닌 센터(관리자)도 있을 수 있고, profiles RLS 는
  // 역할에 따라 일부 행을 숨기므로(예: 교육생↔같은 반 교육생) 이름이
  // "알 수 없음"으로 뜨는 문제가 있었다. 방 접근 자체는 위에서 RLS 로
  // 이미 검증됐으므로, 표시용 이름 조회만 admin 클라이언트로 수행한다.
  const personIds = Array.from(
    new Set([...partIds, ...((msgs ?? []).map((m: any) => m.sender_id))]),
  );
  const adminDb = createAdminClient();
  const { data: peopleRaw } = personIds.length
    ? await adminDb
        .from("profiles")
        .select("id, name, english_name, username, role")
        .in("id", personIds)
    : { data: [] as any[] };

  // 표시 이름 — 강사가 보면 교육생은 영문 이름 우선, 센터(관리자) 발신자는
  // 역할에 맞는 센터 명칭으로. 센터·교육생이 보면 한글 이름 그대로.
  const partSet = new Set(partIds);
  const people = ((peopleRaw ?? []) as any[]).map((p) => {
    let displayName = p.name;
    if (p.role === "admin") {
      displayName = profile.role === "teacher" ? "Siwonschool Center" : "시원스쿨 센터";
    } else if (p.role === "student" && profile.role === "teacher") {
      displayName = p.english_name?.trim() || p.name;
    }
    return { ...p, name: displayName, isParticipant: partSet.has(p.id) };
  });

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
