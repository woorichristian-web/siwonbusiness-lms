// 과정 ↔ 대화방 자동 동기화.
// 과정이 생성/수정되거나 강사 배정·교육생 등록이 바뀔 때 호출해서,
// 반(배정 강사)별로 대화방을 만들고 참여자(강사 + 그 반 학생들)를 맞춘다.
// 대화방 이름에는 수업 요일·시간이 들어간다. 예:
//   "Business Expressions & Conversations · 화 09:00"
//   (강사가 여러 명이면 " · Jay Rho" 처럼 강사명이 덧붙는다)
// 0031 마이그레이션(conversations.course_id/teacher_id) 적용 전이면 조용히 건너뛴다.
import { createAdminClient } from "@/lib/supabase/admin";

const DAY_KO: Record<string, string> = {
  mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일",
};

function scheduleLabel(weekdays: string[] | null, classTime: string | null): string {
  const days = (weekdays ?? []).map((d) => DAY_KO[d] ?? d).join("·");
  const time = classTime ? String(classTime).slice(0, 5) : "";
  return [days, time].filter(Boolean).join(" ");
}

export async function syncCourseChatRooms(courseId: string) {
  try {
    const admin = createAdminClient();

    const { data: course } = await admin
      .from("courses")
      .select("id, name, weekdays, class_time")
      .eq("id", courseId)
      .maybeSingle();
    if (!course) return;

    // 배정 강사 (현재 활성)
    const { data: cts } = await admin
      .from("course_teachers")
      .select("teacher_id")
      .eq("course_id", courseId)
      .is("assigned_until", null);
    const teacherIds: string[] = Array.from(new Set((cts ?? []).map((r: any) => r.teacher_id)));
    if (teacherIds.length === 0) return; // 강사 배정 전에는 대화방을 만들지 않음

    const { data: tps } = await admin
      .from("profiles").select("id, name").in("id", teacherIds);
    const teacherName = new Map<string, string>((tps ?? []).map((p: any) => [p.id, p.name]));

    // 반별 학생: 이 과정 예약에서 학생별 주 강사(예약 최다)를 계산
    const { data: bks } = await admin
      .from("bookings").select("student_id, slot_id").eq("course_id", courseId);
    const slotIds = Array.from(new Set((bks ?? []).map((b: any) => b.slot_id)));
    const slotTeacher = new Map<string, string>();
    if (slotIds.length > 0) {
      const { data: sl } = await admin
        .from("time_slots").select("id, teacher_id").in("id", slotIds);
      for (const s of sl ?? []) slotTeacher.set(s.id, s.teacher_id);
    }
    const counts = new Map<string, Map<string, number>>();
    for (const b of bks ?? []) {
      const t = slotTeacher.get(b.slot_id);
      if (!t) continue;
      if (!counts.has(b.student_id)) counts.set(b.student_id, new Map());
      const m = counts.get(b.student_id)!;
      m.set(t, (m.get(t) ?? 0) + 1);
    }
    const studentsByTeacher = new Map<string, Set<string>>();
    for (const t of teacherIds) studentsByTeacher.set(t, new Set());
    for (const [sid, m] of counts) {
      const primary = Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0][0];
      studentsByTeacher.get(primary)?.add(sid);
    }
    // 예약이 아직 없는 등록 학생: 강사가 1명뿐이면 그 반으로
    const { data: enr } = await admin
      .from("course_students").select("student_id").eq("course_id", courseId);
    if (teacherIds.length === 1) {
      for (const r of enr ?? []) studentsByTeacher.get(teacherIds[0])!.add(r.student_id);
    }

    const sched = scheduleLabel(course.weekdays as any, course.class_time as any);

    for (const tid of teacherIds) {
      const title =
        `${course.name}${sched ? ` · ${sched}` : ""}` +
        (teacherIds.length > 1 ? ` · ${teacherName.get(tid) ?? ""}` : "");

      // 기존 방 찾기 (course_id+teacher_id) → 없으면 레거시 방(과정명 일치, 미연결) 인수 → 없으면 생성
      let convId: string | null = null;
      const { data: exist, error: linkErr } = await admin
        .from("conversations")
        .select("id, title")
        .eq("course_id", courseId)
        .eq("teacher_id", tid)
        .maybeSingle();
      if (linkErr) return; // 0031 미적용 (컬럼 없음) — 조용히 스킵
      if (exist) {
        convId = exist.id;
        if (exist.title !== title)
          await admin.from("conversations").update({ title, course_name: course.name }).eq("id", convId);
      } else {
        const { data: legacy } = await admin
          .from("conversations")
          .select("id")
          .eq("course_name", course.name)
          .is("course_id", null)
          .limit(1)
          .maybeSingle();
        if (legacy) {
          convId = legacy.id;
          await admin.from("conversations")
            .update({ title, course_name: course.name, course_id: courseId, teacher_id: tid })
            .eq("id", convId);
        } else {
          const { data: created } = await admin
            .from("conversations")
            .insert({ title, course_name: course.name, course_id: courseId, teacher_id: tid })
            .select("id")
            .single();
          convId = created?.id ?? null;
        }
      }
      if (!convId) continue;

      // 참여자 동기화: 강사 + 그 반 학생들
      const desired = new Set<string>([tid, ...Array.from(studentsByTeacher.get(tid) ?? [])]);
      const { data: parts } = await admin
        .from("conversation_participants")
        .select("profile_id")
        .eq("conversation_id", convId);
      const current = new Set((parts ?? []).map((p: any) => p.profile_id));
      const toAdd = Array.from(desired).filter((id) => !current.has(id));
      const toRemove = Array.from(current).filter((id) => !desired.has(id));
      if (toAdd.length > 0) {
        await admin.from("conversation_participants").upsert(
          toAdd.map((id) => ({ conversation_id: convId!, profile_id: id })),
          { onConflict: "conversation_id,profile_id" },
        );
      }
      if (toRemove.length > 0) {
        await admin
          .from("conversation_participants")
          .delete()
          .eq("conversation_id", convId)
          .in("profile_id", toRemove);
      }
    }
  } catch {
    // 대화방 동기화 실패가 본 작업(과정 저장 등)을 막지 않도록 조용히 무시
  }
}
