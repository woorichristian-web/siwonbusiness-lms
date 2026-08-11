import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import TeacherScheduleTabs from "@/components/TeacherScheduleTabs";
import type { TimeSlot } from "@/lib/types";
import type { BookingEvent, ClassSlotEvent } from "@/components/ClassSchedulesView";
import type { TeacherCourse, CoursePattern } from "@/components/TeacherCoursesView";

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

  // 1) Teacher's slots
  const { data: slots } = await supabase
    .from("time_slots")
    .select("*")
    .eq("teacher_id", profile.id)
    .order("start_at", { ascending: true });

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
      .select("id, name, username, company_name, phone, course_name")
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
      student_name: s?.name ?? "Unknown",
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

  // 7) Build per-student "course" info (bookings-based) for the Course Information tab.
  //    A real courses entity doesn't exist yet, so we derive from bookings + student
  //    profiles. course_code / course_name / language have no DB source → null ("—").
  const courseByStudent = new Map<string, any>();
  for (const b of bookingsRaw) {
    const s = studentById.get(b.student_id);
    const slot = slotById.get(b.slot_id);
    let c = courseByStudent.get(b.student_id);
    if (!c) {
      c = {
        student_id: b.student_id,
        student_name: s?.name ?? "Unknown",
        company: s?.company_name ?? null,
        course_code: null as string | null,
        course_name: (s?.course_name ?? null) as string | null,
        language: null as string | null,
        class_types: new Set<string>(),
        formats: new Set<string>(),
        period_start: b.start_at as string,
        period_end: b.end_at as string,
        sessions_count: 0,
        patterns: new Map<
          string,
          { weekday: number; time: string; duration_min: number; count: number }
        >(),
      };
      courseByStudent.set(b.student_id, c);
    }
    if (slot?.class_type) c.class_types.add(slot.class_type);
    if (slot?.format) c.formats.add(slot.format);
    if (b.start_at < c.period_start) c.period_start = b.start_at;
    if (b.end_at > c.period_end) c.period_end = b.end_at;
    c.sessions_count++;
    // Weekly pattern in KST (UTC+9)
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

  const courses: TeacherCourse[] = Array.from(courseByStudent.values())
    .map((c) => ({
      student_id: c.student_id,
      student_name: c.student_name,
      company: c.company,
      course_code: c.course_code,
      course_name: c.course_name,
      language: c.language,
      class_types: Array.from(c.class_types) as string[],
      formats: Array.from(c.formats) as string[],
      period_start: c.period_start,
      period_end: c.period_end,
      sessions_count: c.sessions_count,
      patterns: (Array.from(c.patterns.values()) as CoursePattern[]).sort(
        (a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time),
      ),
    }))
    .sort((a, b) => a.student_name.localeCompare(b.student_name));

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">My Classes</h1>
          <p className="text-sm text-slate-500">
            <b>Class Schedules</b> for upcoming sessions ·{" "}
            <b>Availability</b> to set times you can teach.
          </p>
        </header>
        <TeacherScheduleTabs
          slots={(slots ?? []) as TimeSlot[]}
          bookingCounts={bookingCounts}
          bookingEvents={bookingEvents}
          classSlots={classSlots}
          courses={courses}
        />
      </main>
    </>
  );
}
