import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import ClassManageView, { type ClassRow } from "@/components/ClassManageView";

export const dynamic = "force-dynamic";

export default async function TeacherClassManagePage() {
  const profile = await requireRole(["teacher", "admin"]);
  const supabase = createClient();

  // Teacher's slots
  const { data: slots } = await supabase
    .from("time_slots")
    .select("id, class_type, format")
    .eq("teacher_id", profile.id);
  const slotById = new Map<string, any>();
  for (const s of slots ?? []) slotById.set(s.id, s);
  const slotIds = (slots ?? []).map((s: any) => s.id);

  // Confirmed bookings on this teacher's slots
  let bookingsRaw: any[] = [];
  if (slotIds.length > 0) {
    const { data: b } = await supabase
      .from("bookings")
      .select("id, slot_id, student_id, start_at, end_at, status")
      .in("slot_id", slotIds)
      .eq("status", "confirmed");
    bookingsRaw = b ?? [];
  }

  // Students
  const studentIds = Array.from(new Set(bookingsRaw.map((b) => b.student_id)));
  const studentById = new Map<string, any>();
  if (studentIds.length > 0) {
    const { data: students } = await supabase
      .from("profiles")
      .select("id, name, username, company_name, course_name")
      .in("id", studentIds);
    for (const s of students ?? []) studentById.set(s.id, s);
  }

  // Attendance
  const bookingIds = bookingsRaw.map((b) => b.id);
  const attendanceByBooking = new Map<string, "present" | "absent" | "late" | "reschedule" | "other">();
  if (bookingIds.length > 0) {
    const { data: atts } = await supabase
      .from("attendance")
      .select("booking_id, status")
      .in("booking_id", bookingIds);
    for (const a of atts ?? []) {
      attendanceByBooking.set(a.booking_id, a.status as any);
    }
  }

  // Feedback (full rows so we can re-open the modal with existing values)
  const feedbackByBooking = new Map<string, any>();
  if (bookingIds.length > 0) {
    const { data: fbs } = await supabase
      .from("feedback")
      .select("*")
      .in("booking_id", bookingIds);
    for (const f of fbs ?? []) feedbackByBooking.set(f.booking_id, f);
  }

  // Build class rows
  const classRows: ClassRow[] = bookingsRaw.map((b) => {
    const s = studentById.get(b.student_id);
    const slot = slotById.get(b.slot_id);
    const fb = feedbackByBooking.get(b.id);
    return {
      booking_id: b.id,
      slot_id: b.slot_id,
      start_at: b.start_at,
      end_at: b.end_at,
      student_id: b.student_id,
      student_name: s?.name ?? "Unknown",
      student_username: s?.username ?? "",
      student_company: s?.company_name ?? null,
      course_name: s?.course_name ?? null,
      class_type: slot?.class_type ?? "1on1",
      format: slot?.format ?? "online",
      attendance: attendanceByBooking.get(b.id) ?? null,
      feedback: fb ?? null,
    };
  });

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">Management</h1>
          <p className="text-sm text-slate-500">
            Handle pending evaluations first, then mark attendance and feedback for each course.
          </p>
        </header>
        <ClassManageView rows={classRows} />
      </main>
    </>
  );
}
