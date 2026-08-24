"use server";

// 교육생 → 강사 평가(student_teacher_feedback, 1~10점 + 코멘트) 조회.
// 평가에는 course_id 가 없으므로 (교육생, 강사) 쌍이 함께한 예약(bookings→slots)으로
// 어느 과정에서 받은 평가인지 도출한다.
// - 센터: 실명 열람 (과정별 / 강사별)
// - 강사 본인: 익명 취합 (반별 평균 + 코멘트 전체)
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function assertAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("관리자(센터) 권한이 필요합니다.");
}

/** (student|teacher) 쌍 → 함께한 과정 id 집합 */
async function pairCourseMap(
  admin: any,
  filter: { courseId?: string; teacherId?: string },
): Promise<Map<string, Set<string>>> {
  let q = admin
    .from("bookings")
    .select("student_id, slot_id, course_id")
    .not("course_id", "is", null);
  if (filter.courseId) q = q.eq("course_id", filter.courseId);
  const { data: bks } = await q;
  const slotIds: string[] = Array.from(new Set((bks ?? []).map((b: any) => b.slot_id)));
  const slotTeacher = new Map<string, string>();
  for (let i = 0; i < slotIds.length; i += 500) {
    const { data: sl } = await admin
      .from("time_slots").select("id, teacher_id").in("id", slotIds.slice(i, i + 500));
    for (const s of sl ?? []) slotTeacher.set(s.id, s.teacher_id);
  }
  const map = new Map<string, Set<string>>();
  for (const b of bks ?? []) {
    const t = slotTeacher.get(b.slot_id);
    if (!t) continue;
    if (filter.teacherId && t !== filter.teacherId) continue;
    const k = `${b.student_id}|${t}`;
    (map.get(k) ?? map.set(k, new Set()).get(k)!).add(b.course_id);
  }
  return map;
}

const avgOf = (ns: number[]) =>
  ns.length ? Math.round((ns.reduce((s, v) => s + v, 0) / ns.length) * 10) / 10 : null;

export interface EvalItem {
  student_name: string;
  rating: number | null;
  comment: string | null;
  date: string;
}

/** 과정(강좌) 단위 — 이 과정의 각 강사가 받은 평가 (센터 전용, 실명) */
export async function getCourseTeacherEvalAdmin(courseId: string) {
  try { await assertAdmin(); }
  catch (e: any) { return { ok: false as const, error: e.message }; }
  const admin = createAdminClient();

  const { data: course } = await admin
    .from("courses").select("name, code").eq("id", courseId).maybeSingle();
  if (!course) return { ok: false as const, error: "과정을 찾을 수 없습니다." };

  const { data: cts } = await admin
    .from("course_teachers").select("teacher_id")
    .eq("course_id", courseId).is("assigned_until", null);
  const tIds: string[] = Array.from(new Set((cts ?? []).map((r: any) => r.teacher_id)));

  const pairMap = await pairCourseMap(admin, { courseId });
  const { data: rows } = tIds.length
    ? await admin
        .from("student_teacher_feedback")
        .select("student_id, teacher_id, rating, comment, updated_at")
        .in("teacher_id", tIds)
    : { data: [] as any[] };
  const rel = (rows ?? []).filter((r: any) =>
    pairMap.get(`${r.student_id}|${r.teacher_id}`)?.has(courseId));

  const pIds = Array.from(new Set([...tIds, ...rel.map((r: any) => r.student_id)]));
  const names = new Map<string, string>();
  if (pIds.length) {
    const { data: ps } = await admin.from("profiles").select("id, name").in("id", pIds);
    for (const p of ps ?? []) names.set(p.id, p.name);
  }

  const teachers = tIds.map((tid) => {
    const list = rel.filter((r: any) => r.teacher_id === tid);
    return {
      teacher_id: tid,
      teacher_name: names.get(tid) ?? "(알 수 없음)",
      avg: avgOf(list.map((r: any) => r.rating).filter((n: any) => typeof n === "number")),
      count: list.length,
      items: list.map((r: any): EvalItem => ({
        student_name: names.get(r.student_id) ?? "(탈퇴한 회원)",
        rating: r.rating ?? null,
        comment: r.comment ?? null,
        date: r.updated_at,
      })),
    };
  });

  return {
    ok: true as const,
    courseName: course.name as string,
    courseCode: (course.code ?? null) as string | null,
    teachers,
  };
}

/** 강사 단위 — 이 강사가 받은 모든 평가 + 어느 과정·누구에게 받았는지 (센터 전용, 실명) */
export async function getTeacherEvalAdmin(teacherId: string) {
  try { await assertAdmin(); }
  catch (e: any) { return { ok: false as const, error: e.message }; }
  const admin = createAdminClient();

  const pairMap = await pairCourseMap(admin, { teacherId });
  const courseIds = Array.from(new Set(
    Array.from(pairMap.values()).flatMap((s) => Array.from(s)),
  ));
  const courseName = new Map<string, string>();
  if (courseIds.length) {
    const { data: cs } = await admin.from("courses").select("id, name").in("id", courseIds);
    for (const c of cs ?? []) courseName.set(c.id, c.name);
  }

  const { data: rows } = await admin
    .from("student_teacher_feedback")
    .select("student_id, rating, comment, updated_at")
    .eq("teacher_id", teacherId)
    .order("updated_at", { ascending: false });
  const sIds = Array.from(new Set((rows ?? []).map((r: any) => r.student_id)));
  const sNames = new Map<string, string>();
  if (sIds.length) {
    const { data: ps } = await admin.from("profiles").select("id, name").in("id", sIds);
    for (const p of ps ?? []) sNames.set(p.id, p.name);
  }

  const items = (rows ?? []).map((r: any) => ({
    student_name: sNames.get(r.student_id) ?? "(탈퇴한 회원)",
    courses: Array.from(pairMap.get(`${r.student_id}|${teacherId}`) ?? [])
      .map((cid) => courseName.get(cid))
      .filter(Boolean) as string[],
    rating: (r.rating ?? null) as number | null,
    comment: (r.comment ?? null) as string | null,
    date: r.updated_at as string,
  }));
  const avg = avgOf(items.map((i) => i.rating).filter((n): n is number => typeof n === "number"));

  return { ok: true as const, avg, count: items.length, items };
}

/**
 * 강사 본인용 — 반(과정)별 익명 취합: 평균 + 코멘트 전체 (이름 없음).
 * requireRole 로 강사 본인임이 검증된 서버 페이지에서만 호출한다.
 */
export async function getMyTeachingEval(teacherId: string) {
  const admin = createAdminClient();
  const pairMap = await pairCourseMap(admin, { teacherId });
  const { data: rows } = await admin
    .from("student_teacher_feedback")
    .select("student_id, rating, comment, updated_at")
    .eq("teacher_id", teacherId);

  // 과정별 그룹 (한 학생이 여러 과정에 걸치면 각 과정에 포함, 과정 미상은 "Other")
  const byCourse = new Map<string, { ratings: number[]; comments: string[] }>();
  for (const r of rows ?? []) {
    const cids = Array.from(pairMap.get(`${r.student_id}|${teacherId}`) ?? []);
    const keys = cids.length ? cids : ["__other__"];
    for (const k of keys) {
      if (!byCourse.has(k)) byCourse.set(k, { ratings: [], comments: [] });
      const g = byCourse.get(k)!;
      if (typeof r.rating === "number") g.ratings.push(r.rating);
      if (r.comment?.trim()) g.comments.push(r.comment.trim());
    }
  }
  const courseIds = Array.from(byCourse.keys()).filter((k) => k !== "__other__");
  const courseName = new Map<string, string>();
  if (courseIds.length) {
    const { data: cs } = await admin.from("courses").select("id, name").in("id", courseIds);
    for (const c of cs ?? []) courseName.set(c.id, c.name);
  }
  return Array.from(byCourse.entries()).map(([k, g]) => ({
    course: k === "__other__" ? "Other" : (courseName.get(k) ?? "Course"),
    avg: avgOf(g.ratings),
    count: g.ratings.length,
    comments: g.comments,
  })).sort((a, b) => a.course.localeCompare(b.course));
}
