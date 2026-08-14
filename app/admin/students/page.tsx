import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import StudentManageClient, {
  type SManageStudent,
  type SManageCourse,
} from "@/components/StudentManageClient";

export const dynamic = "force-dynamic";

const ATTENDED = new Set(["present", "late"]);

export default async function AdminStudentsPage() {
  const profile = await requireRole(["admin"]);
  const supabase = createClient();

  const { data: studentRows } = await supabase
    .from("profiles")
    .select("id, name, username, company_name, course_name")
    .eq("role", "student")
    .order("name");
  const students = (studentRows ?? []) as any[];

  const { data: courseRows } = await supabase
    .from("courses")
    .select("id, name, company_name")
    .order("created_at", { ascending: false });
  const courses = (courseRows ?? []) as any[];

  // 과정별 학생
  const studentCourseIds = new Map<string, string[]>(); // student -> [courseId]
  const courseStudentIds = new Map<string, string[]>(); // course -> [studentId]
  if (courses.length > 0) {
    const { data: cs } = await supabase
      .from("course_students")
      .select("course_id, student_id");
    for (const r of cs ?? []) {
      (studentCourseIds.get(r.student_id) ?? studentCourseIds.set(r.student_id, []).get(r.student_id)!).push(r.course_id);
      (courseStudentIds.get(r.course_id) ?? courseStudentIds.set(r.course_id, []).get(r.course_id)!).push(r.student_id);
    }
  }

  // 과정별 출석 집계 (bookings.course_id + attendance)
  const courseStats: Record<string, { students: number; bookings: number; attended: number; markedTotal: number }> = {};
  for (const c of courses) courseStats[c.id] = { students: (courseStudentIds.get(c.id) ?? []).length, bookings: 0, attended: 0, markedTotal: 0 };

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, course_id")
    .eq("status", "confirmed")
    .not("course_id", "is", null);
  const bkById = new Map<string, string>(); // booking -> course
  for (const b of bookings ?? []) {
    bkById.set(b.id, b.course_id);
    if (courseStats[b.course_id]) courseStats[b.course_id].bookings++;
  }
  const bookingIds = (bookings ?? []).map((b: any) => b.id);
  if (bookingIds.length > 0) {
    const { data: atts } = await supabase
      .from("attendance")
      .select("booking_id, status")
      .in("booking_id", bookingIds);
    for (const a of atts ?? []) {
      const cid = bkById.get(a.booking_id);
      if (!cid || !courseStats[cid]) continue;
      if (a.status === "reschedule" || a.status === "other") continue;
      courseStats[cid].markedTotal++;
      if (ATTENDED.has(a.status)) courseStats[cid].attended++;
    }
  }

  const outStudents: SManageStudent[] = students.map((s) => ({
    id: s.id,
    name: s.name,
    username: s.username,
    company_name: s.company_name ?? null,
    course_name: s.course_name ?? null,
    course_ids: studentCourseIds.get(s.id) ?? [],
  }));
  const outCourses: SManageCourse[] = courses.map((c) => ({
    id: c.id,
    name: c.name,
    company_name: c.company_name ?? null,
    stats: courseStats[c.id],
  }));

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">교육생 관리</h1>
          <p className="text-sm text-slate-500">과정을 선택하면 대시보드가 해당 과정으로 바뀝니다.</p>
        </header>
        <StudentManageClient students={outStudents} courses={outCourses} />
      </main>
    </>
  );
}
