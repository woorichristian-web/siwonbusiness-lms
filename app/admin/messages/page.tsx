import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import StudentMessageList from "@/components/StudentMessageList";
import AdminSentList, { type SentGroup } from "@/components/AdminSentList";
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
  const senderNames = new Map<
    string,
    { name: string; role: string; href?: string; context?: string }
  >();
  if (senderIds.length > 0) {
    const { data: senders } = await supabase
      .from("profiles")
      .select("id, name, role, company_name, course_name")
      .in("id", senderIds);

    // 강사 발신자의 담당 과정명 (course_teachers → courses)
    const teacherSenderIds = (senders ?? [])
      .filter((s: any) => s.role === "teacher")
      .map((s: any) => s.id);
    const coursesByTeacher = new Map<string, string[]>();
    if (teacherSenderIds.length > 0) {
      const { data: cts } = await supabase
        .from("course_teachers")
        .select("teacher_id, course_id")
        .in("teacher_id", teacherSenderIds)
        .is("assigned_until", null);
      const cIds = Array.from(new Set((cts ?? []).map((r: any) => r.course_id)));
      const nameById = new Map<string, string>();
      if (cIds.length > 0) {
        const { data: cs } = await supabase.from("courses").select("id, name").in("id", cIds);
        for (const c of cs ?? []) nameById.set(c.id, c.name);
      }
      for (const r of cts ?? []) {
        const nm = nameById.get(r.course_id);
        if (nm) (coursesByTeacher.get(r.teacher_id) ?? coursesByTeacher.set(r.teacher_id, []).get(r.teacher_id)!).push(nm);
      }
    }

    for (const s of senders ?? []) {
      let href: string | undefined;
      let context: string | undefined;
      if (s.role === "student") {
        href = `/admin/progress/${s.id}`;
        context = [s.company_name, s.course_name].filter(Boolean).join(" · ") || undefined;
      } else if (s.role === "teacher") {
        href = `/admin/teachers/${s.id}`;
        const cs = coursesByTeacher.get(s.id);
        context = cs && cs.length ? cs.join(", ") : undefined;
      }
      senderNames.set(s.id, { name: s.name, role: s.role, href, context });
    }
  }

  // ====================================================================
  // 보낸 메시지 — 같은 시각·같은 내용(단체 발송)은 1건으로 묶는다.
  // 수신자 전원이 같은 과정 수강생이면 과정명을 표시.
  // ====================================================================
  const { data: sentRows } = await supabase
    .from("messages")
    .select("id, recipient_id, body, read_at, created_at")
    .eq("sender_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const sentRecipientIds = Array.from(
    new Set((sentRows ?? []).map((m: any) => m.recipient_id)),
  );
  const recipientNameById = new Map<string, string>();
  if (sentRecipientIds.length > 0) {
    const { data: rp } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", sentRecipientIds);
    for (const r of rp ?? []) recipientNameById.set(r.id, r.name);
  }
  // 수신자별 수강 과정 (과정 전체 발송 판별용)
  const coursesByStudent = new Map<string, Set<string>>();
  const courseNameById = new Map<string, string>();
  if (sentRecipientIds.length > 0) {
    const { data: enr } = await supabase
      .from("course_students")
      .select("course_id, student_id")
      .in("student_id", sentRecipientIds);
    const cIds = Array.from(new Set((enr ?? []).map((r: any) => r.course_id)));
    if (cIds.length > 0) {
      const { data: cs } = await supabase.from("courses").select("id, name").in("id", cIds);
      for (const c of cs ?? []) courseNameById.set(c.id, c.name);
    }
    for (const r of enr ?? []) {
      (coursesByStudent.get(r.student_id) ?? coursesByStudent.set(r.student_id, new Set()).get(r.student_id)!).add(r.course_id);
    }
  }

  const groupMap = new Map<string, SentGroup>();
  for (const m of sentRows ?? []) {
    const key = `${m.created_at}|${m.body}`;
    let g = groupMap.get(key);
    if (!g) {
      g = { key, body: m.body, created_at: m.created_at, course_name: null, recipients: [] };
      groupMap.set(key, g);
    }
    g.recipients.push({
      name: recipientNameById.get(m.recipient_id) ?? "—",
      read: !!m.read_at,
    });
    // 과정 판별용 임시 저장
    (g as any)._ids = [...((g as any)._ids ?? []), m.recipient_id];
  }
  for (const g of groupMap.values()) {
    const ids: string[] = (g as any)._ids ?? [];
    delete (g as any)._ids;
    if (ids.length < 2) continue;
    // 모든 수신자가 공통으로 속한 과정이 있으면 그 과정명 표시
    let common: Set<string> | null = null;
    let allEnrolled = true;
    for (const id of ids) {
      const cs = coursesByStudent.get(id);
      if (!cs || cs.size === 0) { allEnrolled = false; break; }
      if (common === null) {
        common = new Set<string>(cs);
      } else {
        const prev: Set<string> = common;
        common = new Set<string>([...prev].filter((c) => cs.has(c)));
      }
      if (common.size === 0) { allEnrolled = false; break; }
    }
    if (allEnrolled && common && common.size > 0) {
      g.course_name = courseNameById.get([...common][0]) ?? null;
    }
  }
  const sentGroups = Array.from(groupMap.values()).slice(0, 30);

  // 모든 사용자 (자기 자신 제외)
  const { data: allUsers } = await supabase
    .from("profiles")
    .select("id, name, role, username, company_name, assigned_teacher_id")
    .neq("id", profile.id)
    .order("name", { ascending: true });

  const users = (allUsers ?? []) as any[];
  const admins = users.filter((u) => u.role === "admin");
  const teachers = users.filter((u) => u.role === "teacher");
  const students = users.filter((u) => u.role === "student");

  // 교육생별 주 강사 (이 학생의 예약이 가장 많은 강사 · 없으면 배정 강사)
  const { data: stBks } = await supabase
    .from("bookings").select("student_id, slot_id").eq("status", "confirmed");
  const stSlotIds = Array.from(new Set((stBks ?? []).map((b: any) => b.slot_id)));
  const slotTeacher = new Map<string, string>();
  for (let i = 0; i < stSlotIds.length; i += 500) {
    const { data: sl } = await supabase
      .from("time_slots").select("id, teacher_id").in("id", stSlotIds.slice(i, i + 500));
    for (const s of sl ?? []) slotTeacher.set(s.id, s.teacher_id);
  }
  const bkCnt = new Map<string, Map<string, number>>();
  for (const b of stBks ?? []) {
    const t = slotTeacher.get(b.slot_id);
    if (!t) continue;
    if (!bkCnt.has(b.student_id)) bkCnt.set(b.student_id, new Map());
    const m = bkCnt.get(b.student_id)!;
    m.set(t, (m.get(t) ?? 0) + 1);
  }
  const teacherNameById = new Map(teachers.map((t) => [t.id, t.name]));

  // 교육생: 기업별 → 그 하위 강사별 그룹 (기업 · 강사 라벨)
  const byCompany = new Map<string, Map<string, any[]>>();
  for (const s of students) {
    const comp = s.company_name || "(기업 미지정)";
    const m = bkCnt.get(s.id);
    const tid = m
      ? Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0][0]
      : (s.assigned_teacher_id ?? null);
    const tKey = tid && teacherNameById.has(tid) ? tid : "__none__";
    if (!byCompany.has(comp)) byCompany.set(comp, new Map());
    const tMap = byCompany.get(comp)!;
    (tMap.get(tKey) ?? tMap.set(tKey, []).get(tKey)!).push(s);
  }
  const studentGroups: RecipientGroup[] = [];
  for (const [comp, tMap] of Array.from(byCompany.entries()).sort((a, b) => a[0].localeCompare(b[0], "ko"))) {
    const entries = Array.from(tMap.entries()).sort((a, b) => {
      if (a[0] === "__none__") return 1;
      if (b[0] === "__none__") return -1;
      return (teacherNameById.get(a[0]) ?? "").localeCompare(teacherNameById.get(b[0]) ?? "");
    });
    for (const [tKey, list] of entries) {
      const tLabel = tKey === "__none__" ? "강사 미배정" : `${teacherNameById.get(tKey)} 강사`;
      studentGroups.push({
        label: `${comp} · ${tLabel}`,
        recipients: list.map((s: any) => ({
          id: s.id, name: s.name, sublabel: s.username,
        })),
      });
    }
  }

  const groups: RecipientGroup[] = [
    {
      label: "관리자",
      recipients: admins.map((a) => ({
        id: a.id, name: a.name, sublabel: a.username,
      })),
    },
    {
      label: "강사",
      recipients: teachers.map((t) => ({
        id: t.id, name: t.name, sublabel: t.username,
      })),
    },
    ...studentGroups,
  ];

  // 단체 발송 옵션
  const bulkOptions: BulkOption[] = [];
  if (teachers.length > 0) {
    bulkOptions.push({
      value: "__all_teachers__",
      label: `모든 강사에게 (${teachers.length})`,
      ids: teachers.map((t) => t.id),
      confirmText: `${teachers.length}명의 강사 전체에게 이 메시지를 보낼까요?`,
    });
  }
  if (students.length > 0) {
    bulkOptions.push({
      value: "__all_students__",
      label: `모든 교육생에게 (${students.length})`,
      ids: students.map((s) => s.id),
      confirmText: `${students.length}명의 교육생 전체에게 이 메시지를 보낼까요?`,
    });
  }
  if (teachers.length > 0 && students.length > 0) {
    bulkOptions.push({
      value: "__everyone__",
      label: `모든 강사 + 교육생 (${teachers.length + students.length})`,
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
            상단의 "모든 강사/교육생에게" 옵션으로 단체 발송도 가능합니다.
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

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-700">보낸 메시지</h2>
          <p className="mb-2 text-xs text-slate-500">
            같은 내용으로 여러 명에게 발송한 메시지는 1건으로 묶여 표시됩니다. 클릭하면 받은 사람 명단이 보입니다.
          </p>
          <AdminSentList groups={sentGroups} />
        </section>
      </main>
    </>
  );
}
