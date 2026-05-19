import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import TeacherMessageCompose from "@/components/TeacherMessageCompose";
import StudentMessageList from "@/components/StudentMessageList";
import type { Message } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TeacherMessagesPage() {
  const profile = await requireRole(["teacher", "admin"]);
  const supabase = createClient();
  const isTeacher = profile.role === "teacher";

  // ====================================================================
  // 1) 받은 메시지함 (Inbox)
  // ====================================================================
  const { data: inbox } = await supabase
    .from("messages")
    .select("*")
    .eq("recipient_id", profile.id)
    .order("created_at", { ascending: false });

  const senderIds = Array.from(new Set((inbox ?? []).map((m: any) => m.sender_id)));
  const senderInfo = new Map<string, { name: string; role: string }>();
  if (senderIds.length > 0) {
    const { data: senders } = await supabase
      .from("profiles")
      .select("id, name, role")
      .in("id", senderIds);
    for (const s of senders ?? []) senderInfo.set(s.id, { name: s.name, role: s.role });
  }

  // ====================================================================
  // 2) 받는 사람 목록 (강사: 본인 수업에 신청한 학생, 관리자: 모든 학생)
  // ====================================================================
  let students: { id: string; name: string; username: string; company_name: string | null }[] = [];
  if (isTeacher) {
    const { data: slots } = await supabase
      .from("time_slots")
      .select("id")
      .eq("teacher_id", profile.id);
    const slotIds = (slots ?? []).map((s: any) => s.id);
    if (slotIds.length > 0) {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("student_id")
        .in("slot_id", slotIds)
        .eq("status", "confirmed");
      const studentIds = Array.from(new Set((bookings ?? []).map((b: any) => b.student_id)));
      if (studentIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, name, username, company_name")
          .in("id", studentIds);
        students = (profs ?? []) as any;
      }
    }
  } else {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, name, username, company_name")
      .eq("role", "student")
      .order("company_name", { ascending: true });
    students = (profs ?? []) as any;
  }

  // ====================================================================
  // 3) 보낸 메시지 (최근 30건)
  // ====================================================================
  const { data: sent } = await supabase
    .from("messages")
    .select("id, recipient_id, body, read_at, created_at")
    .eq("sender_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const recipientNames = new Map<string, string>();
  const recipientIds = Array.from(new Set((sent ?? []).map((m: any) => m.recipient_id)));
  if (recipientIds.length > 0) {
    const { data: rs } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", recipientIds);
    for (const r of rs ?? []) recipientNames.set(r.id, r.name);
  }

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <header>
          <h1 className="text-xl font-bold text-slate-800">
            {isTeacher ? "Messages" : "메시지"}
          </h1>
          <p className="text-sm text-slate-500">
            {isTeacher
              ? "View received messages and send messages to your students."
              : "받은 메시지를 확인하고, 강사·교육생에게 메시지를 보내세요."}
          </p>
        </header>

        {/* Inbox — 받은 메시지 */}
        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-700">
            {isTeacher ? "Inbox" : "받은 메시지함"}
          </h2>
          <StudentMessageList
            messages={(inbox ?? []) as Message[]}
            senderInfo={Object.fromEntries(senderInfo)}
          />
        </section>

        {/* Compose + sent history */}
        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-700">
            {isTeacher ? "Send a message" : "메시지 보내기"}
          </h2>
          <TeacherMessageCompose
            students={students}
            sent={(sent ?? []).map((m: any) => ({
              ...m,
              recipient_name: recipientNames.get(m.recipient_id) ?? "—",
            }))}
            english={isTeacher}
          />
        </section>
      </main>
    </>
  );
}
