import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import TeacherMessageCompose from "@/components/TeacherMessageCompose";
import StudentMessageList from "@/components/StudentMessageList";
import type { Message } from "@/lib/types";
import { getTestCourseIds } from "@/lib/testCourses";

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
  // 수업(과정)별 학생 그룹 — 드롭다운 하단에 과정명으로 묶어 표시
  let courseGroups: { course: string; students: typeof students }[] = [];
  if (isTeacher) {
    const [{ data: slots }, testIds] = await Promise.all([
      supabase
        .from("time_slots")
        .select("id, course_id")
        .eq("teacher_id", profile.id),
      getTestCourseIds(supabase),
    ]);
    const slotIds = (slots ?? [])
      .filter((s: any) => !s.course_id || !testIds.has(s.course_id))
      .map((s: any) => s.id);
    if (slotIds.length > 0) {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("student_id, course_id")
        .in("slot_id", slotIds)
        .eq("status", "confirmed");
      const studentIds = Array.from(new Set((bookings ?? []).map((b: any) => b.student_id)));
      if (studentIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, name, english_name, username, company_name")
          .in("id", studentIds);
        // 강사에게는 영문 이름 우선 표시
        students = ((profs ?? []) as any[]).map((p) => ({
          ...p,
          name: p.english_name?.trim() || p.name,
        }));

        // 과정명 조회 후 과정별로 학생 묶기 (과정 미지정 예약은 "Other")
        const courseIds = Array.from(new Set((bookings ?? []).map((b: any) => b.course_id).filter(Boolean)));
        const courseNames = new Map<string, string>();
        if (courseIds.length > 0) {
          const { data: cs } = await supabase
            .from("courses").select("id, name").in("id", courseIds);
          for (const c of cs ?? []) courseNames.set(c.id, c.name);
        }
        const byId = new Map(students.map((s) => [s.id, s]));
        const grouped = new Map<string, Map<string, (typeof students)[number]>>();
        for (const b of bookings ?? []) {
          const st = byId.get(b.student_id);
          if (!st) continue;
          const key = b.course_id ? (courseNames.get(b.course_id) ?? "Other") : "Other";
          if (!grouped.has(key)) grouped.set(key, new Map());
          grouped.get(key)!.set(st.id, st);
        }
        courseGroups = Array.from(grouped.entries())
          .sort(([a], [b]) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)))
          .map(([course, m]) => ({
            course,
            students: Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name)),
          }));
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
  // 자동 발송 메시지(수업 알림·커리큘럼 알림)는 제외 — 직접 보낸 메시지만 표시
  const { data: sent } = await supabase
    .from("messages")
    .select("id, recipient_id, body, read_at, created_at")
    .eq("sender_id", profile.id)
    .not("body", "like", "[수업 24시간 전 알림]%")
    .not("body", "like", "[커리큘럼 업데이트]%")
    .order("created_at", { ascending: false })
    .limit(30);

  const recipientNames = new Map<string, string>();
  const recipientIds = Array.from(new Set((sent ?? []).map((m: any) => m.recipient_id)));
  if (recipientIds.length > 0) {
    const { data: rs } = await supabase
      .from("profiles")
      .select("id, name, role")
      .in("id", recipientIds);
    for (const r of rs ?? [])
      recipientNames.set(r.id, r.role === "admin" ? "Siwonschool Center" : r.name);
  }

  // 센터(관리자) 대표 계정 — 드롭다운 최상단 + 기본 선택. QA 계정 제외.
  const { data: adminRows } = await supabase
    .from("profiles")
    .select("id, name, username")
    .eq("role", "admin")
    .order("name");
  const centerId =
    (adminRows ?? []).filter(
      (a: any) => a.username !== "qa.shot" && !String(a.name ?? "").startsWith("QA"),
    )[0]?.id ?? null;

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
            english={isTeacher}
          />
        </section>

        {/* Compose + sent history */}
        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-700">
            {isTeacher ? "Send a message" : "메시지 보내기"}
          </h2>
          <TeacherMessageCompose
            students={students}
            courseGroups={courseGroups}
            centerId={centerId}
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
