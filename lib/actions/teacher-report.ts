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

export interface TRMonth { ym: string; period: string; hours: number; amount: number | null }
export interface TRTeacher {
  name: string; username: string; phone: string | null; specialty: string | null;
  hourly_rate: number | null; bank_name: string | null; bank_account: string | null; account_holder: string | null;
  months: TRMonth[]; totalHours: number; totalAmount: number | null;
}
export interface TRCourse {
  name: string; code: string | null; period: string; teachers: TRTeacher[];
}
export interface TRCompany { company: string; courses: TRCourse[] }
export interface TRTotal {
  name: string; username: string; hourly_rate: number | null;
  courseCount: number; totalHours: number; totalAmount: number | null;
}
export interface TeacherPayrollReport {
  generatedAt: string; author: string;
  companies: TRCompany[]; totals: TRTotal[];
}

/** 강사 정산 리포트 데이터 — 기업별 > 강좌별 > 강사(+월별 페이롤). */
export async function getTeacherPayrollReport():
  Promise<{ ok: true; data: TeacherPayrollReport } | { ok: false; error: string }> {
  let ctx;
  try { ctx = await assertAdmin(); }
  catch (e: any) { return { ok: false, error: e.message }; }
  const { supabase, adminName } = ctx;

  const { data: courses } = await supabase.from("courses").select("*");
  const courseList = courses ?? [];
  const courseIds = courseList.map((c: any) => c.id);
  if (courseIds.length === 0)
    return { ok: true, data: { generatedAt: nowKST(), author: adminName, companies: [], totals: [] } };

  const { data: cts } = await supabase
    .from("course_teachers")
    .select("course_id, teacher_id")
    .in("course_id", courseIds)
    .is("assigned_until", null);

  const teacherIds = Array.from(new Set((cts ?? []).map((r: any) => r.teacher_id)));
  const profById = new Map<string, any>();
  const metaById = new Map<string, any>();
  if (teacherIds.length > 0) {
    const [{ data: ps }, { data: ms }] = await Promise.all([
      supabase.from("profiles").select("id, name, username, phone").in("id", teacherIds),
      supabase.from("teachers").select("profile_id, specialty, hourly_rate, bank_name, bank_account, account_holder").in("profile_id", teacherIds),
    ]);
    for (const p of ps ?? []) profById.set(p.id, p);
    for (const m of ms ?? []) metaById.set(m.profile_id, m);
  }

  // 슬롯(강좌·강사·길이) + 예약 + 출석
  const { data: slots } = await supabase
    .from("time_slots")
    .select("id, teacher_id, course_id, slot_duration_minutes")
    .in("course_id", courseIds);
  const slotById = new Map<string, any>();
  for (const s of slots ?? []) slotById.set(s.id, s);
  const slotIds = (slots ?? []).map((s: any) => s.id);

  const attOk = new Set<string>();
  let bks: any[] = [];
  if (slotIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, slot_id, start_at")
      .in("slot_id", slotIds)
      .eq("status", "confirmed");
    bks = bookings ?? [];
    const bIds = bks.map((b: any) => b.id);
    if (bIds.length > 0) {
      const { data: atts } = await supabase
        .from("attendance").select("booking_id, status").in("booking_id", bIds);
      for (const a of atts ?? [])
        if (a.status === "present" || a.status === "late") attOk.add(a.booking_id);
    }
  }

  // (course,teacher) → 월별 집계. 같은 슬롯의 다중 예약(그룹수업)은 세션 1회로 계산.
  const seenSession = new Set<string>(); // slot|start
  const agg = new Map<string, Map<string, { hours: number; first: string; last: string }>>(); // course|teacher → ym
  for (const b of bks) {
    if (!attOk.has(b.id)) continue;
    const slot = slotById.get(b.slot_id);
    if (!slot) continue;
    const sessionKey = `${b.slot_id}|${b.start_at}`;
    if (seenSession.has(sessionKey)) continue; // 그룹 수업 중복 방지
    seenSession.add(sessionKey);
    const key = `${slot.course_id}|${slot.teacher_id}`;
    const d = new Date(b.start_at);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const byYm = agg.get(key) ?? agg.set(key, new Map()).get(key)!;
    const cur = byYm.get(ym) ?? { hours: 0, first: b.start_at, last: b.start_at };
    cur.hours += (slot.slot_duration_minutes ?? 60) / 60;
    if (b.start_at < cur.first) cur.first = b.start_at;
    if (b.start_at > cur.last) cur.last = b.start_at;
    byYm.set(ym, cur);
  }

  const fmtD = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });

  // 기업별 구조화
  const byCompany = new Map<string, TRCompany>();
  const totalByTeacher = new Map<string, TRTotal>();
  const sortedCourses = [...courseList].sort((a: any, b: any) =>
    (a.company_name ?? "").localeCompare(b.company_name ?? "") || a.name.localeCompare(b.name));

  for (const c of sortedCourses) {
    const companyKey = c.company_name || "(회사 미지정)";
    const comp = byCompany.get(companyKey) ?? byCompany.set(companyKey, { company: companyKey, courses: [] }).get(companyKey)!;
    const courseTeachers = (cts ?? []).filter((r: any) => r.course_id === c.id);
    if (courseTeachers.length === 0) continue;

    const trTeachers: TRTeacher[] = courseTeachers.map((r: any) => {
      const p = profById.get(r.teacher_id) ?? {};
      const m = metaById.get(r.teacher_id) ?? {};
      const rate = m.hourly_rate != null ? Number(m.hourly_rate) : null;
      const byYm = agg.get(`${c.id}|${r.teacher_id}`) ?? new Map();
      const months: TRMonth[] = Array.from(byYm.entries())
        .sort(([a]: any, [b]: any) => a.localeCompare(b))
        .map(([ym, v]: any) => ({
          ym,
          period: `${fmtD(v.first)} ~ ${fmtD(v.last)}`,
          hours: Math.round(v.hours * 100) / 100,
          amount: rate != null ? Math.round(rate * v.hours) : null,
        }));
      const totalHours = Math.round(months.reduce((s, x) => s + x.hours, 0) * 100) / 100;
      const totalAmount = rate != null ? Math.round(rate * totalHours) : null;

      // 종합 합산
      const tot = totalByTeacher.get(r.teacher_id) ?? totalByTeacher.set(r.teacher_id, {
        name: p.name ?? "—", username: p.username ?? "—", hourly_rate: rate,
        courseCount: 0, totalHours: 0, totalAmount: rate != null ? 0 : null,
      }).get(r.teacher_id)!;
      tot.courseCount++;
      tot.totalHours = Math.round((tot.totalHours + totalHours) * 100) / 100;
      if (tot.totalAmount != null && totalAmount != null) tot.totalAmount += totalAmount;

      return {
        name: p.name ?? "—", username: p.username ?? "—", phone: p.phone ?? null,
        specialty: m.specialty ?? null, hourly_rate: rate,
        bank_name: m.bank_name ?? null, bank_account: m.bank_account ?? null, account_holder: m.account_holder ?? null,
        months, totalHours, totalAmount,
      };
    });

    comp.courses.push({
      name: c.name, code: c.code ?? null,
      period: `${c.start_date ?? "?"} ~ ${c.end_date ?? "?"}`,
      teachers: trTeachers,
    });
  }

  const companies = Array.from(byCompany.values()).filter((c) => c.courses.length > 0);
  const totals = Array.from(totalByTeacher.values()).sort((a, b) => a.name.localeCompare(b.name));

  return { ok: true, data: { generatedAt: nowKST(), author: adminName, companies, totals } };
}

function nowKST(): string {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
