import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import StudentMessageList from "@/components/StudentMessageList";
import MessageCompose, { type RecipientGroup } from "@/components/MessageCompose";
import type { Message } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StudentMessagesPage() {
  const profile = await requireRole(["student", "admin"]);
  const supabase = createClient();

  // 1) 받은 메시지
  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("recipient_id", profile.id)
    .order("created_at", { ascending: false });

  // 발신자 이름 매핑
  const senderIds = Array.from(new Set((messages ?? []).map((m: any) => m.sender_id)));
  const senderNames = new Map<string, { name: string; role: string }>();
  if (senderIds.length > 0) {
    const { data: senders } = await supabase
      .from("profiles")
      .select("id, name, role")
      .in("id", senderIds);
    for (const s of senders ?? []) senderNames.set(s.id, { name: s.name, role: s.role });
  }

  // 2) 보낼 수 있는 대상: 관리자 전체 + 배정 강사 + 본인이 예약한 슬롯들의 강사
  const { data: admins } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("role", "admin")
    .order("name");

  // 본인 예약 슬롯의 강사 id 모으기
  const teacherIds = new Set<string>();
  if (profile.assigned_teacher_id) teacherIds.add(profile.assigned_teacher_id);

  const { data: myBookings } = await supabase
    .from("bookings")
    .select("slot_id")
    .eq("student_id", profile.id)
    .eq("status", "confirmed");

  const mySlotIds = Array.from(new Set((myBookings ?? []).map((b: any) => b.slot_id)));
  if (mySlotIds.length > 0) {
    const { data: slots } = await supabase
      .from("time_slots")
      .select("teacher_id")
      .in("id", mySlotIds);
    for (const s of slots ?? []) teacherIds.add(s.teacher_id);
  }

  let teachers: Array<{ id: string; name: string }> = [];
  if (teacherIds.size > 0) {
    const { data: ts } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", Array.from(teacherIds));
    teachers = (ts ?? []) as any;
  }

  const groups: RecipientGroup[] = [
    {
      label: "관리자",
      recipients: (admins ?? []).map((a: any) => ({
        id: a.id, name: a.name, sublabel: "관리자",
      })),
    },
    {
      label: "강사",
      recipients: teachers.map((t) => ({
        id: t.id, name: t.name, sublabel: "강사",
      })),
    },
  ];

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <header>
          <h1 className="text-xl font-bold text-slate-800">메시지</h1>
          <p className="text-sm text-slate-500">
            관리자/강사와 메시지를 주고받을 수 있습니다.
          </p>
        </header>

        {/* 작성 */}
        <MessageCompose
          title="새 메시지 보내기"
          description="배정된 강사 또는 관리자에게 문의하실 내용을 전달하세요."
          recipientLabel="받는 사람"
          placeholder="예: 이번 주 수업 시간 변경이 가능할까요?"
          groups={groups}
        />

        {/* 받은 메시지 */}
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
