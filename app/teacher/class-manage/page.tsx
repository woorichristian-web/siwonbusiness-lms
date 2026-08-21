import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import ClassManageView, { type ClassRow } from "@/components/ClassManageView";
import CurriculumManager, { type CurriculumItem } from "@/components/CurriculumManager";

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
  const attendanceNotesByBooking = new Map<string, string | null>();
  if (bookingIds.length > 0) {
    const { data: atts } = await supabase
      .from("attendance")
      .select("booking_id, status, notes")
      .in("booking_id", bookingIds);
    for (const a of atts ?? []) {
      attendanceByBooking.set(a.booking_id, a.status as any);
      attendanceNotesByBooking.set(a.booking_id, a.notes ?? null);
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
      attendance_notes: attendanceNotesByBooking.get(b.id) ?? null,
      feedback: fb ?? null,
    };
  });

  // 담당 과정 + 커리큘럼 (강사가 확인·업로드)
  const { data: myCts } = await supabase
    .from("course_teachers")
    .select("course_id")
    .eq("teacher_id", profile.id)
    .is("assigned_until", null);
  const myCourseIds = Array.from(new Set((myCts ?? []).map((r: any) => r.course_id)));
  let myCourses: {
    id: string; name: string; curriculum_updated_at: string | null; items: CurriculumItem[];
  }[] = [];
  if (myCourseIds.length > 0) {
    const [{ data: cs }, { data: cur }] = await Promise.all([
      supabase.from("courses").select("id, name, curriculum_updated_at").in("id", myCourseIds),
      supabase
        .from("course_curriculum")
        .select("course_id, session_no, session_date, topic, details, materials, sort_order")
        .in("course_id", myCourseIds)
        .order("sort_order", { ascending: true }),
    ]);
    const byCourse = new Map<string, CurriculumItem[]>();
    for (const r of cur ?? [])
      (byCourse.get(r.course_id) ?? byCourse.set(r.course_id, []).get(r.course_id)!).push({
        session_no: r.session_no, session_date: r.session_date, topic: r.topic,
        details: r.details, materials: r.materials,
      });
    myCourses = (cs ?? []).map((c: any) => ({
      id: c.id, name: c.name, curriculum_updated_at: c.curriculum_updated_at,
      items: byCourse.get(c.id) ?? [],
    }));
  }

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

        {myCourses.length > 0 && (
          <div className="mt-8 space-y-4">
            {myCourses.map((c) => (
              <CurriculumManager
                key={c.id}
                courseId={c.id}
                courseName={c.name}
                rows={c.items}
                canEdit
                updatedAt={c.curriculum_updated_at}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
