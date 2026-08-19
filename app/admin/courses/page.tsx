import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import CoursesAdminClient, {
  type CourseRow,
  type TeacherOption,
} from "@/components/CoursesAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const profile = await requireRole(["admin"]);
  const supabase = createClient();

  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: allTeachers } = await supabase
    .from("profiles")
    .select("id, name, username")
    .eq("role", "teacher")
    .order("name");

  const courseIds = (courses ?? []).map((c: any) => c.id);

  // 과정별 수강 인원
  const studentCounts: Record<string, number> = {};
  if (courseIds.length > 0) {
    const { data: css } = await supabase
      .from("course_students")
      .select("course_id")
      .in("course_id", courseIds);
    for (const r of css ?? [])
      studentCounts[r.course_id] = (studentCounts[r.course_id] ?? 0) + 1;
  }

  // 과정별 현재 배정 강사
  const assignments: Record<string, { teacher_id: string; name: string }[]> = {};
  if (courseIds.length > 0) {
    const { data: cts } = await supabase
      .from("course_teachers")
      .select("course_id, teacher_id")
      .in("course_id", courseIds)
      .is("assigned_until", null);
    const tById = new Map((allTeachers ?? []).map((t: any) => [t.id, t]));
    for (const ct of cts ?? []) {
      (assignments[ct.course_id] ??= []).push({
        teacher_id: ct.teacher_id,
        name: (tById.get(ct.teacher_id) as any)?.name ?? "(알 수 없음)",
      });
    }
  }

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">과정 관리</h1>
          <p className="text-sm text-slate-500">
            센터에서 과정을 생성하고 강사를 배정하면 강사·교육생 페이지에 반영됩니다.
          </p>
        </header>
        <CoursesAdminClient
          courses={(courses ?? []) as CourseRow[]}
          allTeachers={(allTeachers ?? []) as TeacherOption[]}
          assignments={assignments}
          studentCounts={studentCounts}
        />
      </main>
    </>
  );
}
