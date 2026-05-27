import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import TeacherScheduleTabs from "@/components/TeacherScheduleTabs";
import type { TimeSlot } from "@/lib/types";
import type { BookingEvent } from "@/components/ClassSchedulesView";

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
        />
      </main>
    </>
  );
}
