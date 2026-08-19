"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function assertAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("관리자(센터) 권한이 필요합니다.");
  return supabase;
}

export interface CourseInput {
  code?: string | null;
  name: string;
  company_name?: string | null;
  language?: string | null;
  textbook?: string | null;
  format?: "online" | "offline" | null;
  class_type?: "1on1" | "small_group" | null;
  capacity?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  weekdays?: string[];
  class_time?: string | null;
  duration_min?: number | null;
  total_sessions?: number | null;
}

function clean(input: CourseInput) {
  return {
    code: input.code?.trim() || null,
    name: input.name.trim(),
    company_name: input.company_name?.trim() || null,
    language: input.language?.trim() || null,
    textbook: input.textbook?.trim() || null,
    format: input.format || null,
    class_type: input.class_type || null,
    capacity: input.capacity ?? null,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    weekdays: input.weekdays ?? [],
    class_time: input.class_time?.trim() || null,
    duration_min: input.duration_min ?? null,
    total_sessions: input.total_sessions ?? null,
  };
}

export async function createCourse(input: CourseInput) {
  let supabase;
  try { supabase = await assertAdmin(); }
  catch (e: any) { return { ok: false as const, error: e.message }; }
  if (!input.name?.trim()) return { ok: false as const, error: "강좌명은 필수입니다." };

  const payload = clean(input);
  // 코드 자동 생성: 기업약자(2)-언어약자(2, 대문자)-YY+생성순번(01~)
  if (!payload.code) {
    const abbr = (s: string | null, fb: string) =>
      (s ?? "").trim().replace(/[^A-Za-z가-힣]/g, "").slice(0, 2).toUpperCase() || fb;
    const comp = abbr(payload.company_name, "XX");
    const lang = abbr(payload.language, "EN");
    const yy = String(new Date(Date.now() + 9 * 3600 * 1000).getUTCFullYear()).slice(2);
    const prefix = `${comp}-${lang}-${yy}`;
    const { data: existing } = await supabase
      .from("courses")
      .select("code")
      .like("code", `${prefix}%`);
    let maxSeq = 0;
    const seqRe = new RegExp("^" + prefix + "(\\d{2})");
    for (const r of existing ?? []) {
      const m = String(r.code ?? "").match(seqRe);
      if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
    }
    // 과정명 약자: 3자 이상 단어의 첫 글자 최대 3개
    // (예: Business Expressions & Conversations → BEC)
    const nameAbbr = (payload.name.match(/[A-Za-z가-힣]+/g) ?? [])
      .filter((w: string) => w.length >= 3)
      .slice(0, 3)
      .map((w: string) => w[0].toUpperCase())
      .join("");
    payload.code = `${prefix}${String(maxSeq + 1).padStart(2, "0")}${nameAbbr ? "-" + nameAbbr : ""}`;
  }

  const { data, error } = await supabase
    .from("courses")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/courses");
  return { ok: true as const, courseId: data.id as string };
}

export async function updateCourse(courseId: string, input: CourseInput) {
  let supabase;
  try { supabase = await assertAdmin(); }
  catch (e: any) { return { ok: false as const, error: e.message }; }

  const { error } = await supabase
    .from("courses")
    .update({ ...clean(input), updated_at: new Date().toISOString() })
    .eq("id", courseId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true as const };
}

/** 과정 삭제 — 연결된 예약·슬롯도 함께 삭제(복원 불가). */
export async function deleteCourse(courseId: string) {
  let supabase;
  try { supabase = await assertAdmin(); }
  catch (e: any) { return { ok: false as const, error: e.message }; }

  const { error: e1 } = await supabase.from("bookings").delete().eq("course_id", courseId);
  if (e1) return { ok: false as const, error: e1.message };
  const { error: e2 } = await supabase.from("time_slots").delete().eq("course_id", courseId);
  if (e2) return { ok: false as const, error: e2.message };
  const { error: e3 } = await supabase.from("courses").delete().eq("id", courseId);
  if (e3) return { ok: false as const, error: e3.message };

  revalidatePath("/admin/courses");
  return { ok: true as const };
}

/** 강사 여러 명 배정 (이미 활성 배정된 강사는 건너뜀). */
export async function assignCourseTeachers(courseId: string, teacherIds: string[]) {
  let supabase;
  try { supabase = await assertAdmin(); }
  catch (e: any) { return { ok: false as const, error: e.message }; }
  if (teacherIds.length === 0) return { ok: true as const };

  const { data: existing } = await supabase
    .from("course_teachers")
    .select("teacher_id")
    .eq("course_id", courseId)
    .is("assigned_until", null);
  const already = new Set((existing ?? []).map((r: any) => r.teacher_id));
  const rows = teacherIds
    .filter((tid) => !already.has(tid))
    .map((tid) => ({ course_id: courseId, teacher_id: tid }));
  if (rows.length === 0) return { ok: true as const };

  const { error } = await supabase.from("course_teachers").insert(rows);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true as const };
}

/** 배정 강사 해제 (이력은 종료 처리로 보존). */
export async function removeCourseTeacher(courseId: string, teacherId: string) {
  let supabase;
  try { supabase = await assertAdmin(); }
  catch (e: any) { return { ok: false as const, error: e.message }; }

  const { error } = await supabase
    .from("course_teachers")
    .update({ assigned_until: new Date().toISOString().slice(0, 10), is_active: false })
    .eq("course_id", courseId)
    .eq("teacher_id", teacherId)
    .is("assigned_until", null);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true as const };
}

/**
 * 강사 교체 — 기존 강사(old)는 오늘부로 종료(이력·과거 데이터 보존),
 * 새 강사(new)를 오늘부터 배정. 이 과정의 '앞으로 예정된' 슬롯만 새 강사로 재배정.
 */
export async function replaceCourseTeacher(
  courseId: string,
  oldTeacherId: string,
  newTeacherId: string,
) {
  let supabase;
  try { supabase = await assertAdmin(); }
  catch (e: any) { return { ok: false as const, error: e.message }; }
  if (oldTeacherId === newTeacherId)
    return { ok: false as const, error: "같은 강사입니다." };

  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  // 1) 기존 배정 종료 + 교체 기록
  const { error: e1 } = await supabase
    .from("course_teachers")
    .update({ assigned_until: today, is_active: false, replaced_by: newTeacherId })
    .eq("course_id", courseId)
    .eq("teacher_id", oldTeacherId)
    .is("assigned_until", null);
  if (e1) return { ok: false as const, error: e1.message };

  // 2) 새 강사 배정
  const { error: e2 } = await supabase
    .from("course_teachers")
    .insert({ course_id: courseId, teacher_id: newTeacherId, assigned_from: today });
  if (e2) return { ok: false as const, error: e2.message };

  // 3) 이 과정의 '예정(미래)' 슬롯만 새 강사로 재배정 (과거 슬롯·데이터는 그대로)
  await supabase
    .from("time_slots")
    .update({ teacher_id: newTeacherId })
    .eq("course_id", courseId)
    .eq("teacher_id", oldTeacherId)
    .gte("start_at", nowIso);

  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true as const };
}

// ---------------------------------------------------------------------
// 과정 데이터 리포트 (엑셀 다운로드용 집계): 주차별 점수 추이 + 출석율
// ---------------------------------------------------------------------
import { feedbackTotal10 } from "@/lib/types";
import { getCourseProgressMap, progressLabel } from "@/lib/courseProgress";

export interface CourseReportStudent {
  name: string;
  weeklyAvg: (number | null)[];
  attended: number;
  markedTotal: number;
  rate: number | null;
}
export interface CourseReportData {
  courseName: string;
  code: string | null;
  company: string | null;
  weeks: string[]; // 주 시작일(월요일) 라벨
  courseWeeklyAvg: (number | null)[];
  attended: number;
  markedTotal: number;
  rate: number | null;
  students: CourseReportStudent[];
}

function mondayKST(iso: string): string {
  const kst = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const dow = kst.getUTCDay() || 7; // 1=Mon..7=Sun
  const monday = new Date(kst.getTime() - (dow - 1) * 86400000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${monday.getUTCFullYear()}-${p(monday.getUTCMonth() + 1)}-${p(monday.getUTCDate())}`;
}
function fbAvg(fb: any): number | null {
  return feedbackTotal10(fb);
}

export async function getCourseReportData(courseId: string) {
  let supabase;
  try { supabase = await assertAdmin(); }
  catch (e: any) { return { ok: false as const, error: e.message }; }

  const { data: course } = await supabase
    .from("courses").select("name, code, company_name").eq("id", courseId).maybeSingle();
  if (!course) return { ok: false as const, error: "과정을 찾을 수 없습니다." };

  const { data: cs } = await supabase
    .from("course_students").select("student_id").eq("course_id", courseId);
  const studentIds = (cs ?? []).map((r: any) => r.student_id);
  const nameById = new Map<string, string>();
  if (studentIds.length > 0) {
    const { data: ps } = await supabase.from("profiles").select("id, name").in("id", studentIds);
    for (const p of ps ?? []) nameById.set(p.id, p.name);
  }

  const { data: bookings } = await supabase
    .from("bookings").select("id, student_id, start_at")
    .eq("course_id", courseId).eq("status", "confirmed");
  const bks = bookings ?? [];
  const bookingIds = bks.map((b: any) => b.id);

  const attByBk = new Map<string, string>();
  const fbByBk = new Map<string, number | null>();
  if (bookingIds.length > 0) {
    const [{ data: atts }, { data: fbs }] = await Promise.all([
      supabase.from("attendance").select("booking_id, status").in("booking_id", bookingIds),
      supabase.from("feedback").select("*").in("booking_id", bookingIds),
    ]);
    for (const a of atts ?? []) attByBk.set(a.booking_id, a.status);
    for (const f of fbs ?? []) fbByBk.set(f.booking_id, fbAvg(f));
  }

  // 주차 집합
  const weekSet = new Set<string>();
  for (const b of bks) weekSet.add(mondayKST(b.start_at));
  const weeks = Array.from(weekSet).sort();
  const wIdx = new Map(weeks.map((w, i) => [w, i]));

  // 누적자
  const courseWeekSum = weeks.map(() => 0);
  const courseWeekCnt = weeks.map(() => 0);
  let attended = 0, markedTotal = 0;
  const perStudent = new Map<string, { sum: number[]; cnt: number[]; att: number; marked: number }>();
  for (const id of studentIds)
    perStudent.set(id, { sum: weeks.map(() => 0), cnt: weeks.map(() => 0), att: 0, marked: 0 });

  for (const b of bks) {
    const wi = wIdx.get(mondayKST(b.start_at))!;
    const score = fbByBk.get(b.id) ?? null;
    const st = perStudent.get(b.student_id);
    if (score != null) {
      courseWeekSum[wi] += score; courseWeekCnt[wi]++;
      if (st) { st.sum[wi] += score; st.cnt[wi]++; }
    }
    const status = attByBk.get(b.id);
    if (status && status !== "reschedule" && status !== "other") {
      markedTotal++; if (status === "present" || status === "late") attended++;
      if (st) { st.marked++; if (status === "present" || status === "late") st.att++; }
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const students: CourseReportStudent[] = studentIds.map((id: string) => {
    const s = perStudent.get(id)!;
    return {
      name: nameById.get(id) ?? "(알 수 없음)",
      weeklyAvg: weeks.map((_, i) => (s.cnt[i] ? round2(s.sum[i] / s.cnt[i]) : null)),
      attended: s.att, markedTotal: s.marked,
      rate: s.marked ? Math.round((s.att / s.marked) * 100) : null,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return {
    ok: true as const,
    data: {
      courseName: course.name, code: course.code, company: course.company_name,
      weeks,
      courseWeeklyAvg: weeks.map((_, i) => (courseWeekCnt[i] ? round2(courseWeekSum[i] / courseWeekCnt[i]) : null)),
      attended, markedTotal,
      rate: markedTotal ? Math.round((attended / markedTotal) * 100) : null,
      students,
    } as CourseReportData,
  };
}

// ---------------------------------------------------------------------
// 과정명 단위 리포트 — 시트=기업별. 학생별 강사/수업시간/만족도/평가/코멘트.
// ---------------------------------------------------------------------
export interface CNStudent {
  name: string; username: string;
  teachers: string;   // 이 학생의 실제 담당 강사(들)
  times: string;      // 이 학생의 수업 시간 패턴
  satisfaction: number | null;      // 설문 평균 (1~10)
  score: number | null;             // 강사 평가 평균 (10점)
  comments: string;   // 설문 주관식 코멘트 (라운드 표기)
}
export interface CNCompany {
  company: string; code: string | null; period: string;
  assignedTeachers: string[]; progress: string; students: CNStudent[];
}
export interface CourseNameReport {
  courseName: string; generatedAt: string; author: string; companies: CNCompany[];
}

export async function getCourseNameReport(courseName: string):
  Promise<{ ok: true; data: CourseNameReport } | { ok: false; error: string }> {
  let supabase;
  try { supabase = await assertAdmin(); }
  catch (e: any) { return { ok: false, error: e.message }; }
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("name").eq("id", user!.id).single();

  const { data: courseRows } = await supabase
    .from("courses").select("*").eq("name", courseName);
  const list = courseRows ?? [];
  if (list.length === 0) return { ok: false, error: "과정을 찾을 수 없습니다." };

  const ROUND_LABEL: Record<number, string> = { 1: "10%", 2: "50%", 3: "최종" };
  const progressMap = await getCourseProgressMap(supabase, list.map((c: any) => c.id));
  const companies: CNCompany[] = [];

  for (const c of list) {
    const [{ data: enr }, { data: cts }, { data: bookings }, { data: surveys }] = await Promise.all([
      supabase.from("course_students").select("student_id").eq("course_id", c.id),
      supabase.from("course_teachers").select("teacher_id").eq("course_id", c.id).is("assigned_until", null),
      supabase.from("bookings").select("id, slot_id, student_id, start_at").eq("course_id", c.id).eq("status", "confirmed"),
      supabase.from("survey_responses").select("student_id, round, rating, comment").eq("course_id", c.id),
    ]);
    const studentIds = Array.from(new Set((enr ?? []).map((r: any) => r.student_id)));
    const teacherIds = Array.from(new Set((cts ?? []).map((r: any) => r.teacher_id)));
    const slotIds = Array.from(new Set((bookings ?? []).map((b: any) => b.slot_id)));

    const nameById = new Map<string, { name: string; username: string }>();
    const idsAll = [...studentIds, ...teacherIds];
    if (idsAll.length > 0) {
      const { data: ps } = await supabase.from("profiles").select("id, name, username").in("id", idsAll);
      for (const p of ps ?? []) nameById.set(p.id, { name: p.name, username: p.username });
    }

    const slotTeacher = new Map<string, string>();
    if (slotIds.length > 0) {
      const { data: sl } = await supabase.from("time_slots").select("id, teacher_id").in("id", slotIds);
      const extraT = Array.from(new Set((sl ?? []).map((s: any) => s.teacher_id).filter((t: string) => !nameById.has(t))));
      if (extraT.length > 0) {
        const { data: tp } = await supabase.from("profiles").select("id, name, username").in("id", extraT);
        for (const p of tp ?? []) nameById.set(p.id, { name: p.name, username: p.username });
      }
      for (const s of sl ?? []) slotTeacher.set(s.id, s.teacher_id);
    }

    // 강사 평가 점수 (feedback total10) per student
    const bIds = (bookings ?? []).map((b: any) => b.id);
    const scoreByStudent = new Map<string, number[]>();
    if (bIds.length > 0) {
      const { data: fbs } = await supabase.from("feedback").select("*").in("booking_id", bIds);
      const bkStudent = new Map((bookings ?? []).map((b: any) => [b.id, b.student_id]));
      for (const f of fbs ?? []) {
        if (f.status !== "submitted") continue;
        const sid = bkStudent.get(f.booking_id);
        const v = feedbackTotal10(f);
        if (sid && v != null)
          (scoreByStudent.get(sid) ?? scoreByStudent.set(sid, []).get(sid)!).push(v);
      }
    }

    // 학생별 강사/시간 패턴
    const WD = ["일", "월", "화", "수", "목", "금", "토"];
    const teachersByStudent = new Map<string, Set<string>>();
    const timesByStudent = new Map<string, Set<string>>();
    for (const b of bookings ?? []) {
      const tid = slotTeacher.get(b.slot_id);
      if (tid) {
        const nm = nameById.get(tid)?.name ?? "—";
        (teachersByStudent.get(b.student_id) ?? teachersByStudent.set(b.student_id, new Set()).get(b.student_id)!).add(nm);
      }
      const kst = new Date(new Date(b.start_at).getTime() + 9 * 3600 * 1000);
      const label = `${WD[kst.getUTCDay()]} ${String(kst.getUTCHours()).padStart(2, "0")}:${String(kst.getUTCMinutes()).padStart(2, "0")}`;
      (timesByStudent.get(b.student_id) ?? timesByStudent.set(b.student_id, new Set()).get(b.student_id)!).add(label);
    }

    // 설문 (만족도 + 코멘트)
    const svRating = new Map<string, number[]>();
    const svComments = new Map<string, string[]>();
    for (const s of surveys ?? []) {
      (svRating.get(s.student_id) ?? svRating.set(s.student_id, []).get(s.student_id)!).push(s.rating);
      if (s.comment?.trim())
        (svComments.get(s.student_id) ?? svComments.set(s.student_id, []).get(s.student_id)!)
          .push(`[${ROUND_LABEL[s.round] ?? s.round}] ${s.comment.trim()}`);
    }
    // 설문 없으면 기존 강사평가(student_teacher_feedback) fallback
    const { data: stf } = studentIds.length
      ? await supabase.from("student_teacher_feedback").select("student_id, rating, comment").in("student_id", studentIds)
      : { data: [] as any[] };
    const stfById = new Map((stf ?? []).map((r: any) => [r.student_id, r]));

    const students: CNStudent[] = studentIds.map((sid) => {
      const p = nameById.get(sid) ?? { name: "—", username: "—" };
      const ratings = svRating.get(sid) ?? [];
      const fallback = stfById.get(sid);
      const satisfaction = ratings.length
        ? Math.round((ratings.reduce((s, n) => s + n, 0) / ratings.length) * 10) / 10
        : (typeof fallback?.rating === "number" ? fallback.rating : null);
      const scores = scoreByStudent.get(sid) ?? [];
      const comments = (svComments.get(sid) ?? []).join("\n")
        || (fallback?.comment?.trim() ? `[기존 평가] ${fallback.comment.trim()}` : "");
      return {
        name: p.name, username: p.username,
        teachers: Array.from(teachersByStudent.get(sid) ?? []).join(", ") || "—",
        times: Array.from(timesByStudent.get(sid) ?? []).sort().join(", ") || "—",
        satisfaction,
        score: scores.length ? Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10 : null,
        comments,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    companies.push({
      company: c.company_name || "(회사 미지정)",
      code: c.code ?? null,
      period: `${c.start_date ?? "?"} ~ ${c.end_date ?? "?"}`,
      assignedTeachers: teacherIds.map((t) => nameById.get(t)?.name ?? "—"),
      progress: progressLabel(progressMap.get(c.id)),
      students,
    });
  }

  const d = new Date(Date.now() + 9 * 3600 * 1000);
  const p2 = (n: number) => String(n).padStart(2, "0");
  return {
    ok: true,
    data: {
      courseName,
      generatedAt: `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`,
      author: me?.name ?? "관리자",
      companies: companies.sort((a, b) => a.company.localeCompare(b.company)),
    },
  };
}
