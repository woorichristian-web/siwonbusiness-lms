import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import TeacherManageList, { type TeacherRow, type TeacherGroup } from "@/components/TeacherManageList";

export const dynamic = "force-dynamic";

export default async function AdminTeachersPage() {
  const profile = await requireRole(["admin"]);
  const supabase = createClient();

  // 독립 쿼리 병렬 실행 (페이지 이동 속도 개선)
  const [{ data: teachers }, { data: metas }, { data: fbs }, { data: cts }] =
    await Promise.all([
      supabase.from("profiles").select("id, name, username").eq("role", "teacher").order("name"),
      supabase.from("teachers").select("profile_id, number_of_classes"),
      supabase.from("student_teacher_feedback").select("teacher_id, rating"),
      supabase.from("course_teachers").select("course_id, teacher_id").is("assigned_until", null),
    ]);
  const list = (teachers ?? []) as any[];
  const teacherIdSet = new Set(list.map((t) => t.id));

  // 메타 (진행 수업 수)
  const classesById = new Map<string, number>();
  for (const m of metas ?? [])
    if (teacherIdSet.has(m.profile_id)) classesById.set(m.profile_id, m.number_of_classes ?? 0);

  // 만족도 (student_teacher_feedback: 1~10)
  const ratingSum = new Map<string, number>();
  const ratingCnt = new Map<string, number>();
  for (const f of fbs ?? []) {
    if (typeof f.rating !== "number" || !teacherIdSet.has(f.teacher_id)) continue;
    ratingSum.set(f.teacher_id, (ratingSum.get(f.teacher_id) ?? 0) + f.rating);
    ratingCnt.set(f.teacher_id, (ratingCnt.get(f.teacher_id) ?? 0) + 1);
  }

  // 담당 과정 (활성) + 진행중 과정 그룹
  const courseCnt = new Map<string, number>();
  const ctRows: { course_id: string; teacher_id: string }[] =
    ((cts ?? []) as any[]).filter((c) => teacherIdSet.has(c.teacher_id));
  for (const c of ctRows)
    courseCnt.set(c.teacher_id, (courseCnt.get(c.teacher_id) ?? 0) + 1);
  const activeCourseIds = Array.from(new Set(ctRows.map((r) => r.course_id)));
  const today = new Date().toISOString().slice(0, 10);
  let activeCourses: { id: string; name: string; company_name: string | null }[] = [];
  if (activeCourseIds.length > 0) {
    const { data: cs } = await supabase
      .from("courses")
      .select("id, name, company_name, end_date")
      .in("id", activeCourseIds);
    activeCourses = (cs ?? [])
      .filter((c: any) => !c.end_date || c.end_date >= today)
      .sort((a: any, b: any) => a.name.localeCompare(b.name)) as any;
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

  // 진행중 과정별 그룹 (같은 강사가 여러 과정에 있으면 각 그룹마다 표시)
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const groups: TeacherGroup[] = activeCourses.map((c) => ({
    key: c.id,
    title: c.name,
    company: c.company_name ?? null,
    teachers: ctRows
      .filter((r) => r.course_id === c.id)
      .map((r) => rowById.get(r.teacher_id))
      .filter((x): x is TeacherRow => !!x)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.teachers.length > 0);
  const assignedIds = new Set(ctRows.map((r) => r.teacher_id));
  const unassigned = rows.filter((r) => !assignedIds.has(r.id));
  if (unassigned.length > 0)
    groups.push({ key: "__unassigned__", title: "미배정 강사", company: null, teachers: unassigned });

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">강사 관리</h1>
          <p className="text-sm text-slate-500">전체 현황 대시보드 · 강사 검색 · 강사별 상세</p>
        </header>
        <TeacherManageList groups={groups} dashboard={dashboard} />
      </main>
    </>
  );
}
