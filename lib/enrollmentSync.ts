// 과정 ↔ 교육생 매칭·예약 자동 동기화.
// ① profiles.course_name(수강 강좌명)이 이 과정명과 같은 교육생을 course_students 에 등록하고
// ② 등록된 전원에게 아직 시작하지 않은 그룹 수업 예약을 자동 생성한다.
//    (1:1 수업은 학생별 시간이 달라 자동 예약하지 않음 — 업로드 스케줄/수강신청으로 처리)
// 업로드 스케줄 칼럼을 비워 두고 나중에 과정에 매칭해도 수업이 채워지게 하는 장치.
import { createAdminClient } from "@/lib/supabase/admin";
import { syncCourseChatRooms } from "@/lib/chatSync";

const GROUP_TYPES = new Set(["group", "group_coaching", "small_group"]);
const WD_NUM: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/**
 * 과정 기간·요일·시간 기준으로 수업 시간표(time_slots)를 자동 생성.
 * 그룹 수업 + 활성 강사 1명일 때만 동작 (반이 여러 개면 수동/업로드로 관리).
 * 이미 같은 시각의 슬롯이 있으면 건너뛰므로 여러 번 호출해도 안전하다.
 */
async function ensureCourseSlots(admin: any, course: any) {
  if (!GROUP_TYPES.has(course.class_type)) return;
  if (!course.start_date || !course.end_date) return;
  const weekdays: string[] = course.weekdays ?? [];
  if (weekdays.length === 0) return;

  const { data: cts } = await admin
    .from("course_teachers").select("teacher_id")
    .eq("course_id", course.id).is("assigned_until", null);
  const tIds = Array.from(new Set((cts ?? []).map((r: any) => r.teacher_id)));
  if (tIds.length !== 1) return;
  const teacherId = tIds[0];

  const duration = course.duration_min ?? 60;
  const dayTimes = (course.day_times ?? {}) as Record<string, string>;
  const wanted: { start: Date; end: Date }[] = [];
  const start = new Date(course.start_date + "T00:00:00+09:00");
  const end = new Date(course.end_date + "T00:00:00+09:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const wd = weekdays.find((w) => WD_NUM[w] === new Date(d.getTime() + 9 * 3600000).getUTCDay());
    if (!wd) continue;
    const time = (dayTimes[wd] ?? course.class_time ?? "09:00").slice(0, 5);
    const kstDate = new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10);
    const s = new Date(`${kstDate}T${time}:00+09:00`);
    wanted.push({ start: s, end: new Date(s.getTime() + duration * 60000) });
  }
  // 총 차시가 정해져 있으면 그 수까지만
  const limit = course.total_sessions ?? wanted.length;
  const sessions = wanted.slice(0, limit);
  if (sessions.length === 0) return;

  const { data: existing } = await admin
    .from("time_slots").select("start_at").eq("course_id", course.id);
  const have = new Set((existing ?? []).map((r: any) => new Date(r.start_at).getTime()));
  const inserts = sessions
    .filter((s) => !have.has(s.start.getTime()))
    .map((s) => ({
      teacher_id: teacherId,
      course_id: course.id,
      start_at: s.start.toISOString(),
      end_at: s.end.toISOString(),
      format: course.format ?? "offline",
      class_type: course.class_type,
      capacity: course.capacity ?? 6,
      status: "open",
      slot_duration_minutes: duration,
    }));
  for (let i = 0; i < inserts.length; i += 100)
    await admin.from("time_slots").insert(inserts.slice(i, i + 100));
}

export async function syncCourseEnrollment(courseId: string) {
  try {
    const admin = createAdminClient();
    const { data: course } = await admin
      .from("courses")
      .select("id, name, company_name, class_type, format, capacity, duration_min, total_sessions, start_date, end_date, weekdays, class_time, day_times")
      .eq("id", courseId)
      .maybeSingle();
    if (!course) return;

    // 0) 시간표가 없으면 과정 일정 기준으로 자동 생성
    await ensureCourseSlots(admin, course);

    // 1) 강좌명 매칭 → 수강 등록 채우기 (회사명이 있으면 같은 회사만)
    let q = admin
      .from("profiles").select("id")
      .eq("role", "student").eq("course_name", course.name);
    if (course.company_name) q = q.eq("company_name", course.company_name);
    const { data: matched } = await q;
    const ids = Array.from(new Set((matched ?? []).map((r: any) => r.id)));
    if (ids.length > 0) {
      await admin.from("course_students").upsert(
        ids.map((id) => ({ course_id: courseId, student_id: id })),
        { onConflict: "course_id,student_id" },
      );
    }

    // 2) 등록 교육생 전원에게 미래 그룹 수업 예약 생성 (이미 있거나 취소한 건 건너뜀)
    const { data: enrolled } = await admin
      .from("course_students").select("student_id").eq("course_id", courseId);
    const students = Array.from(new Set((enrolled ?? []).map((r: any) => r.student_id)));
    if (students.length === 0) return;

    const { data: slots } = await admin
      .from("time_slots")
      .select("id, start_at, end_at, class_type, capacity")
      .eq("course_id", courseId)
      .gt("start_at", new Date().toISOString());
    const groupSlots = (slots ?? []).filter(
      (s: any) => GROUP_TYPES.has(s.class_type) || (s.capacity ?? 1) > 1,
    );
    if (groupSlots.length === 0) return;

    const slotIds = groupSlots.map((s: any) => s.id);
    const have = new Set<string>();
    for (let i = 0; i < slotIds.length; i += 100) {
      const { data: existing } = await admin
        .from("bookings").select("slot_id, student_id")
        .in("slot_id", slotIds.slice(i, i + 100)).in("student_id", students);
      for (const b of existing ?? []) have.add(`${b.slot_id}|${b.student_id}`);
    }

    const inserts: any[] = [];
    for (const s of groupSlots)
      for (const sid of students)
        if (!have.has(`${s.id}|${sid}`))
          inserts.push({
            slot_id: s.id,
            student_id: sid,
            course_id: courseId,
            start_at: s.start_at,
            end_at: s.end_at,
            status: "confirmed",
          });
    for (let i = 0; i < inserts.length; i += 200)
      await admin.from("bookings").insert(inserts.slice(i, i + 200));

    // 예약이 바뀌었으면 대화방 참여자도 맞춰준다
    if (inserts.length > 0) await syncCourseChatRooms(courseId);
  } catch {
    // 동기화 실패가 본 작업(과정 저장·업로드 등)을 막지 않도록 조용히 무시
  }
}

/** 강좌명으로 과정을 찾아 동기화 — 회원 수정·업로드처럼 과정 id 를 모르는 곳에서 사용 */
export async function syncEnrollmentByCourseName(courseName?: string | null, companyName?: string | null) {
  try {
    const name = courseName?.trim();
    if (!name) return;
    const admin = createAdminClient();
    let q = admin.from("courses").select("id").eq("name", name);
    if (companyName?.trim()) q = q.eq("company_name", companyName.trim());
    const { data: courses } = await q;
    for (const c of courses ?? []) await syncCourseEnrollment(c.id);
  } catch { /* 무시 */ }
}
