import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import TeacherManageList, { type TeacherRow } from "@/components/TeacherManageList";

export const dynamic = "force-dynamic";

export default async function AdminTeachersPage() {
  const profile = await requireRole(["admin"]);
  const supabase = createClient();

  const { data: teachers } = await supabase
    .from("profiles")
    .select("id, name, username")
    .eq("role", "teacher")
    .order("name");
  const list = (teachers ?? []) as any[];
  const ids = list.map((t) => t.id);

  // 메타 (진행 수업 수)
  const classesById = new Map<string, number>();
  if (ids.length > 0) {
    const { data: metas } = await supabase
      .from("teachers")
      .select("profile_id, number_of_classes")
      .in("profile_id", ids);
    for (const m of metas ?? [])
      classesById.set(m.profile_id, m.number_of_classes ?? 0);
  }

  // 만족도 (student_teacher_feedback: 1~10)
  const ratingSum = new Map<string, number>();
  const ratingCnt = new Map<string, number>();
  if (ids.length > 0) {
    const { data: fbs } = await supabase
      .from("student_teacher_feedback")
      .select("teacher_id, rating")
      .in("teacher_id", ids);
    for (const f of fbs ?? []) {
      if (typeof f.rating !== "number") continue;
      ratingSum.set(f.teacher_id, (ratingSum.get(f.teacher_id) ?? 0) + f.rating);
      ratingCnt.set(f.teacher_id, (ratingCnt.get(f.teacher_id) ?? 0) + 1);
    }
  }

  // 담당 과정 수 (활성)
  const courseCnt = new Map<string, number>();
  if (ids.length > 0) {
    const { data: cts } = await supabase
      .from("course_teachers")
      .select("teacher_id")
      .in("teacher_id", ids)
      .is("assigned_until", null);
    for (const c of cts ?? [])
      courseCnt.set(c.teacher_id, (courseCnt.get(c.teacher_id) ?? 0) + 1);
  }

  const rows: TeacherRow[] = list.map((t) => {
    const cnt = ratingCnt.get(t.id) ?? 0;
    return {
      id: t.id,
      name: t.name,
      username: t.username,
      classes: classesById.get(t.id) ?? 0,
      courses: courseCnt.get(t.id) ?? 0,
      ratingAvg: cnt > 0 ? Math.round((ratingSum.get(t.id)! / cnt) * 10) / 10 : null,
      ratingCount: cnt,
    };
  });

  // 대시보드 집계
  const totalRatingSum = [...ratingSum.values()].reduce((a, b) => a + b, 0);
  const totalRatingCnt = [...ratingCnt.values()].reduce((a, b) => a + b, 0);
  const dashboard = {
    teacherCount: rows.length,
    avgSatisfaction: totalRatingCnt > 0 ? Math.round((totalRatingSum / totalRatingCnt) * 10) / 10 : null,
    ratingCount: totalRatingCnt,
    totalCourses: [...courseCnt.values()].reduce((a, b) => a + b, 0),
    totalClasses: [...classesById.values()].reduce((a, b) => a + b, 0),
  };

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">강사 관리</h1>
          <p className="text-sm text-slate-500">전체 현황 대시보드 · 강사 검색 · 강사별 상세</p>
        </header>
        <TeacherManageList rows={rows} dashboard={dashboard} />
      </main>
    </>
  );
}
