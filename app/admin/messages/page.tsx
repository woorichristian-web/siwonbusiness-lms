import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import StudentMessageList from "@/components/StudentMessageList";
import MessageCompose, { type RecipientGroup, type BulkOption } from "@/components/MessageCompose";
import type { Message } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  const profile = await requireRole(["admin"]);
  const supabase = createClient();

  // 받은 메시지
  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("recipient_id", profile.id)
    .order("created_at", { ascending: false });

  const senderIds = Array.from(new Set((messages ?? []).map((m: any) => m.sender_id)));
  const senderNames = new Map<string, { name: string; role: string }>();
  if (senderIds.length > 0) {
    const { data: senders } = await supabase
      .from("profiles")
      .select("id, name, role")
      .in("id", senderIds);
    for (const s of senders ?? []) senderNames.set(s.id, { name: s.name, role: s.role });
  }

  // 모든 사용자 (자기 자신 제외)
  const { data: allUsers } = await supabase
    .from("profiles")
    .select("id, name, role, username, company_name")
    .neq("id", profile.id)
    .order("name", { ascending: true });

  const users = (allUsers ?? []) as any[];
  const admins = users.filter((u) => u.role === "admin");
  const teachers = users.filter((u) => u.role === "teacher");
  const students = users.filter((u) => u.role === "student");

  const groups: RecipientGroup[] = [
    {
      label: "👨‍💼 관리자",
      recipients: admins.map((a) => ({
        id: a.id, name: a.name, sublabel: a.username,
      })),
    },
    {
      label: "🧑‍🏫 강사",
      recipients: teachers.map((t) => ({
        id: t.id, name: t.name, sublabel: t.username,
      })),
    },
    {
      label: "🎓 교육생",
      recipients: students.map((s) => ({
        id: s.id, name: s.name,
        sublabel: s.company_name ? `${s.username} · ${s.company_name}` : s.username,
      })),
    },
  ];

  // 단체 발송 옵션
  const bulkOptions: BulkOption[] = [];
  if (teachers.length > 0) {
    bulkOptions.push({
      value: "__all_teachers__",
      label: `📢 모든 강사에게 (${teachers.length})`,
      ids: teachers.map((t) => t.id),
      confirmText: `${teachers.length}명의 강사 전체에게 이 메시지를 보낼까요?`,
    });
  }
  if (students.length > 0) {
    bulkOptions.push({
      value: "__all_students__",
      label: `📢 모든 교육생에게 (${students.length})`,
      ids: students.map((s) => s.id),
      confirmText: `${students.length}명의 교육생 전체에게 이 메시지를 보낼까요?`,
    });
  }
  if (teachers.length > 0 && students.length > 0) {
    bulkOptions.push({
      value: "__everyone__",
      label: `📢 모든 강사 + 교육생 (${teachers.length + students.length})`,
      ids: [...teachers.map((t) => t.id), ...students.map((s) => s.id)],
      confirmText: `강사 ${teachers.length}명 + 교육생 ${students.length}명에게 보낼까요?`,
    });
  }

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <header>
          <h1 className="text-xl font-bold text-slate-800">메시지</h1>
          <p className="text-sm text-slate-500">
            관리자는 강사·교육생 누구에게나 안내 메시지를 보낼 수 있습니다.
            상단의 "📢" 옵션으로 단체 발송도 가능합니다.
          </p>
        </header>

        <MessageCompose
          title="새 메시지 / 안내 발송"
          description="개별 또는 단체 발송. 받은 사람은 즉시 알림을 받습니다."
          recipientLabel="받는 사람"
          placeholder="예: 다음 주 수업 일정 안내드립니다."
          groups={groups}
          bulkOptions={bulkOptions}
        />

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-700">받은 메시지함</h2>
          <StudentMessageList
            messages={(messages ?? []) as Message[]}
            senderInfo={Object.fromEntries(senderNames)}
          />
        </section>
      </main>
    </>
  );
}
