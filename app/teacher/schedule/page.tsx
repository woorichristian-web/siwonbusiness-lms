import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import TeacherScheduleTabs from "@/components/TeacherScheduleTabs";
import type { TimeSlot } from "@/lib/types";
import type { BookingEvent, ClassSlotEvent } from "@/components/ClassSchedulesView";
import type { TeacherCourse, CoursePattern } from "@/components/TeacherCoursesView";
import { getTestCourseIds } from "@/lib/testCourses";

export const dynamic = "force-dynamic";

export default async function TeacherSchedulePage() {
  const profile = await requireRole(["teacher", "admin"]);
  const supabase = createClient();

  // 0) Teacher's meeting room URLs (Zoom/Teams)
  const { data: teacherRow } = await supabase
    .from("teachers")
    .select("zoom_url, teams_url")
    .eq("profile_id", profile.id)
    .maybeSingle();
  const zoomUrl = teacherRow?.zoom_url ?? null;
  const teamsUrl = teacherRow?.teams_url ?? null;

  // 1) Teacher's slots — 테스트 과정 소속 슬롯은 강사에게 숨김
  const [{ data: slotsAll }, testIds] = await Promise.all([
    supabase
      .from("time_slots")
      .select("*")
      .eq("teacher_id", profile.id)
      .order("start_at", { ascending: true }),
    getTestCourseIds(supabase),
  ]);
  const slots = (slotsAll ?? []).filter(
    (s: any) => !s.course_id || !testIds.has(s.course_id),
  );

  const slotIds = (slots ?? []).map((s: any) => s.id);
  const slotById = new Map<string, any>();
  for (const s of slots ?? []) slotById.set(s.id, s);

  // 2) Confirmed bookings + counts
  let bookingsRaw: any[] = [];
  let bookingCounts: Record<string, number> = {};
  if (slotIds.length > 0) {
    const { data: b } = await supabase
      .from("bookings")
      .select("id, slot_id, student_id, start_at, end_at, status")
      .in("slot_id", slotIds)
      .eq("status", "confirmed");
    bookingsRaw = b ?? [];
    for (const x of bookingsRaw) {
      bookingCounts[x.slot_id] = (bookingCounts[x.slot_id] ?? 0) + 1;
    }
  }

  // 3) Student profiles
  const studentIds = Array.from(new Set(bookingsRaw.map((b) => b.student_id)));
  const studentById = new Map<string, any>();
  if (studentIds.length > 0) {
    const { data: students } = await supabase
      .from("profiles")
      .select("id, name, english_name, username, company_name, phone, course_name")
      .in("id", studentIds);
    for (const s of students ?? []) studentById.set(s.id, s);
  }

  // 4) Attendance records
  const bookingIds = bookingsRaw.map((b) => b.id);
  const attendanceMap = new Map<string, { status: string; notes: string | null }>();
  if (bookingIds.length > 0) {
    const { data: atts } = await supabase
      .from("attendance")
      .select("booking_id, status, notes")
      .in("booking_id", bookingIds);
    for (const a of atts ?? []) {
      attendanceMap.set(a.booking_id, { status: a.status, notes: a.notes });
    }
  }

  // 5) Feedback records (full rows)
  const feedbackMap = new Map<string, any>();
  if (bookingIds.length > 0) {
    const { data: fbs } = await supabase
      .from("feedback")
      .select("*")
      .in("booking_id", bookingIds);
    for (const f of fbs ?? []) feedbackMap.set(f.booking_id, f);
  }

  // 6) Build booking events for Class Schedules calendar
  const bookingEvents: BookingEvent[] = bookingsRaw.map((b) => {
    const s = studentById.get(b.student_id);
    const slot = slotById.get(b.slot_id);
    const att = attendanceMap.get(b.id);
    return {
      id: b.id,
      slot_id: b.slot_id,
      student_id: b.student_id,
      // 강사에게는 영문 이름을 우선 표시 (없으면 한글 이름)
      student_name: s?.english_name?.trim() || s?.name || "Unknown",
      student_username: s?.username ?? "",
      student_company: s?.company_name ?? null,
      student_phone: s?.phone ?? null,
      course_name: s?.course_name ?? null,
      start_at: b.start_at,
      end_at: b.end_at,
      format: slot?.format ?? "online",
      class_type: slot?.class_type ?? "1on1",
      attendance_status: (att?.status as any) ?? null,
      attendance_notes: att?.notes ?? null,
      feedback: feedbackMap.get(b.id) ?? null,
      zoom_url: zoomUrl,
      teams_url: teamsUrl,
    };
  });

  // 6b) Assigned classes (teacher's slots) with no confirmed bookings yet —
  //     so they still appear on the Class Schedules calendar/day view.
  const classSlots: ClassSlotEvent[] = (slots ?? [])
    .filter((s: any) => !((bookingCounts[s.id] ?? 0) > 0))
    .map((s: any) => ({
      id: s.id,
      start_at: s.start_at,
      end_at: s.end_at,
      format: s.format,
      class_type: s.class_type,
      capacity: s.capacity,
      booked_count: bookingCounts[s.id] ?? 0,
    }));

  // 7) Course Information — 정식 과정(courses) 기반. 과정당 카드 1개,
  //    카드 안에 수강 교육생 전체 표시. (과정 미배정 강사는 예약 기반 fallback)
  const WD_INDEX: Record<string, number> = {
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  };
  let courses: TeacherCourse[] = [];

  const { data: myCourseLinks } = await supabase
    .from("course_teachers")
    .select("course_id")
    .eq("teacher_id", profile.id)
    .is("assigned_until", null);
  const myCourseIds = Array.from(
    new Set((myCourseLinks ?? []).map((r: any) => r.course_id)),
  ).filter((id) => !testIds.has(id)); // 테스트 과정은 강사에게 숨김

  if (myCourseIds.length > 0) {
    const [{ data: courseRows }, { data: enrollRows }] = await Promise.all([
      supabase.from("courses").select("*").in("id", myCourseIds),
      supabase
        .from("course_students")
        .select("course_id, student_id")
        .in("course_id", myCourseIds),
    ]);
    const enrollIds = Array.from(
      new Set((enrollRows ?? []).map((r: any) => r.student_id)),
    );
    const nameById = new Map<string, string>();
    if (enrollIds.length > 0) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, name, english_name")
        .in("id", enrollIds);
      for (const p of ps ?? [])
        nameById.set(p.id, (p as any).english_name?.trim() || p.name);
    }
    const studentsByCourse = new Map<string, string[]>();
    for (const r of enrollRows ?? []) {
      const nm = nameById.get(r.student_id);
      if (!nm) continue;
      (studentsByCourse.get(r.course_id) ??
        studentsByCourse.set(r.course_id, []).get(r.course_id)!).push(nm);
    }

    courses = (courseRows ?? [])
      .map((c: any) => ({
        id: c.id,
        title: c.name,
        company: c.company_name ?? null,
        course_code: c.code ?? null,
        language: c.language ?? null,
        textbook: c.textbook ?? null,
        class_types: c.class_type ? [c.class_type] : [],
        formats: c.format ? [c.format] : [],
        period_start: c.start_date ?? null,
        period_end: c.end_date ?? null,
        sessions_count: c.total_sessions ?? null,
        patterns: ((c.weekdays ?? []) as string[])
          .map((d) => ({
            weekday: WD_INDEX[d] ?? 0,
            time: c.class_time ?? "—",
            duration_min: c.duration_min ?? 60,
            count: 1,
          }))
          .sort((a, b) => a.weekday - b.weekday) as CoursePattern[],
        students: (studentsByCourse.get(c.id) ?? []).sort((a, b) =>
          a.localeCompare(b),
        ),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  } else {
    // fallback — 과정 미배정: 예약 기반으로 학생별 카드 (기존 동작)
    const courseByStudent = new Map<string, any>();
    for (const b of bookingsRaw) {
      const s = studentById.get(b.student_id);
      const slot = slotById.get(b.slot_id);
      let c = courseByStudent.get(b.student_id);
      if (!c) {
        c = {
          id: b.student_id,
          title: (s?.course_name ?? s?.name ?? "Unknown") as string,
          company: s?.company_name ?? null,
          course_code: null as string | null,
          language: null as string | null,
          textbook: null as string | null,
          class_types: new Set<string>(),
          formats: new Set<string>(),
          period_start: b.start_at as string,
          period_end: b.end_at as string,
          sessions_count: 0,
          patterns: new Map<string, CoursePattern>(),
          students: [s?.english_name?.trim() || s?.name || "Unknown"],
        };
        courseByStudent.set(b.student_id, c);
      }
      if (slot?.class_type) c.class_types.add(slot.class_type);
      if (slot?.format) c.formats.add(slot.format);
      if (b.start_at < c.period_start) c.period_start = b.start_at;
      if (b.end_at > c.period_end) c.period_end = b.end_at;
      c.sessions_count++;
      const kst = new Date(new Date(b.start_at).getTime() + 9 * 3600 * 1000);
      const weekday = kst.getUTCDay();
      const time = `${String(kst.getUTCHours()).padStart(2, "0")}:${String(
        kst.getUTCMinutes(),
      ).padStart(2, "0")}`;
      const duration_min = Math.round(
        (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000,
      );
      const key = `${weekday}-${time}-${duration_min}`;
      const p = c.patterns.get(key);
      if (p) p.count++;
      else c.patterns.set(key, { weekday, time, duration_min, count: 1 });
    }
    courses = Array.from(courseByStudent.values())
      .map((c) => ({
        ...c,
        class_types: Array.from(c.class_types) as string[],
        formats: Array.from(c.formats) as string[],
        patterns: (Array.from(c.patterns.values()) as CoursePattern[]).sort(
          (a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time),
        ),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">My Classes</h1>
          <p className="text-sm text-slate-500">
            <b>Class Schedules</b> for upcoming sessions ·{" "}
            <b>Course Information</b> for your assigned courses.
          </p>
        </header>
        <TeacherScheduleTabs
          slots={(slots ?? []) as TimeSlot[]}
          bookingCounts={bookingCounts}
          bookingEvents={bookingEvents}
          classSlots={classSlots}
          courses={courses}
          availabilityLocked={myCourseIds.length > 0}
        />
      </main>
    </>
  );
}
