"use server";

import { createClient } from "@/lib/supabase/server";

async function assertAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const { data: profile } = await supabase
    .from("profiles").select("role, name").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("관리자 권한이 필요합니다.");
  return { supabase, adminName: profile.name as string };
}

export interface SRStudent {
  name: string; username: string; phone: string | null;
  booked: number; attended: number; marked: number; rate: number | null;
}
export interface SRCourse {
  name: string; code: string | null; period: string; teacherNames: string[];
  students: SRStudent[];
}
export interface SRCompany { company: string; courses: SRCourse[] }
export interface SRTotal {
  name: string; username: string; company: string | null;
  courseCount: number; booked: number; attended: number; marked: number; rate: number | null;
}
export interface StudentCourseReport {
  generatedAt: string; author: string;
  companies: SRCompany[]; totals: SRTotal[];
}

const ATTENDED = new Set(["present", "late"]);
const EXCLUDED = new Set(["reschedule", "other", "absent_business", "company_vacation"]);

/** 교육생 리포트 — 기업별 > 강좌별 > 교육생(출석 통계). */
export async function getStudentCourseReport():
  Promise<{ ok: true; data: StudentCourseReport } | { ok: false; error: string }> {
  let ctx;
  try { ctx = await assertAdmin(); }
  catch (e: any) { return { ok: false, error: e.message }; }
  const { supabase, adminName } = ctx;

  const { data: courses } = await supabase.from("courses").select("*");
  const courseList = courses ?? [];
  const courseIds = courseList.map((c: any) => c.id);

  const { data: enrolls } = courseIds.length
    ? await supabase.from("course_students").select("course_id, student_id").in("course_id", courseIds)
    : { data: [] as any[] };

  const studentIds = Array.from(new Set((enrolls ?? []).map((r: any) => r.student_id)));
  const profById = new Map<string, any>();
  if (studentIds.length > 0) {
    const { data: ps } = await supabase
      .from("profiles").select("id, name, username, phone, company_name").in("id", studentIds);
    for (const p of ps ?? []) profById.set(p.id, p);
  }

  // 강좌별 강사 이름
  const { data: cts } = courseIds.length
    ? await supabase.from("course_teachers").select("course_id, teacher_id").in("course_id", courseIds).is("assigned_until", null)
    : { data: [] as any[] };
  const tIds = Array.from(new Set((cts ?? []).map((r: any) => r.teacher_id)));
  const tName = new Map<string, string>();
  if (tIds.length > 0) {
    const { data: ts } = await supabase.from("profiles").select("id, name").in("id", tIds);
    for (const t of ts ?? []) tName.set(t.id, t.name);
  }

  // 예약 + 출석 (course_id 기준)
  let bks: any[] = [];
  const attByBk = new Map<string, string>();
  if (courseIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, student_id, course_id")
      .in("course_id", courseIds)
      .eq("status", "confirmed");
    bks = bookings ?? [];
    const bIds = bks.map((b: any) => b.id);
    if (bIds.length > 0) {
      const { data: atts } = await supabase
        .from("attendance").select("booking_id, status").in("booking_id", bIds);
      for (const a of atts ?? []) attByBk.set(a.booking_id, a.status);
    }
  }
  // (course|student) 통계
  const stat = new Map<string, { booked: number; attended: number; marked: number }>();
  for (const b of bks) {
    const key = `${b.course_id}|${b.student_id}`;
    const s = stat.get(key) ?? stat.set(key, { booked: 0, attended: 0, marked: 0 }).get(key)!;
    s.booked++;
    const st = attByBk.get(b.id);
    if (st && !EXCLUDED.has(st)) {
      s.marked++;
      if (ATTENDED.has(st)) s.attended++;
    }
  }

  const byCompany = new Map<string, SRCompany>();
  const totalByStudent = new Map<string, SRTotal>();
  const sorted = [...courseList].sort((a: any, b: any) =>
    (a.company_name ?? "").localeCompare(b.company_name ?? "") || a.name.localeCompare(b.name));

  for (const c of sorted) {
    const enrolled = (enrolls ?? []).filter((r: any) => r.course_id === c.id);
    if (enrolled.length === 0) continue;
    const companyKey = c.company_name || "(회사 미지정)";
    const comp = byCompany.get(companyKey) ?? byCompany.set(companyKey, { company: companyKey, courses: [] }).get(companyKey)!;

    const students: SRStudent[] = enrolled.map((r: any) => {
      const p = profById.get(r.student_id) ?? {};
      const s = stat.get(`${c.id}|${r.student_id}`) ?? { booked: 0, attended: 0, marked: 0 };
      const rate = s.marked > 0 ? Math.round((s.attended / s.marked) * 100) : null;

      const tot = totalByStudent.get(r.student_id) ?? totalByStudent.set(r.student_id, {
        name: p.name ?? "—", username: p.username ?? "—", company: p.company_name ?? null,
        courseCount: 0, booked: 0, attended: 0, marked: 0, rate: null,
      }).get(r.student_id)!;
      tot.courseCount++; tot.booked += s.booked; tot.attended += s.attended; tot.marked += s.marked;

      return {
        name: p.name ?? "—", username: p.username ?? "—", phone: p.phone ?? null,
        booked: s.booked, attended: s.attended, marked: s.marked, rate,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    comp.courses.push({
      name: c.name, code: c.code ?? null,
      period: `${c.start_date ?? "?"} ~ ${c.end_date ?? "?"}`,
      teacherNames: (cts ?? []).filter((r: any) => r.course_id === c.id).map((r: any) => tName.get(r.teacher_id) ?? "—"),
      students,
    });
  }

  for (const t of totalByStudent.values())
    t.rate = t.marked > 0 ? Math.round((t.attended / t.marked) * 100) : null;

  const d = new Date(Date.now() + 9 * 3600 * 1000);
  const p2 = (n: number) => String(n).padStart(2, "0");
  const generatedAt = `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;

  return {
    ok: true,
    data: {
      generatedAt, author: adminName,
      companies: Array.from(byCompany.values()).filter((c) => c.courses.length > 0),
      totals: Array.from(totalByStudent.values()).sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
}
