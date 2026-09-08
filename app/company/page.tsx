import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { classTypeKo } from "@/lib/types";
import AppHeader from "@/components/AppHeader";
import CompanyPortalClient, { type CompanyCourseData } from "@/components/CompanyPortalClient";

export const dynamic = "force-dynamic";

const WD_KO: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };

// 기업 담당자(마스터 계정) 전용 — 자기 회사 과정 전체를 읽기 전용으로 열람.
// 데이터는 서버에서 회사명으로 필터해 제공하므로 다른 회사 정보는 접근 불가.
export default async function CompanyPortalPage() {
  const profile = await requireRole(["company"]);
  const admin = createAdminClient();
  const company = profile.company_name;

  if (!company) {
    return (
      <>
        <AppHeader profile={profile} />
        <main className="mx-auto max-w-5xl px-4 py-10 text-center text-sm text-slate-500">
          이 계정에 연결된 회사가 없습니다. 시원스쿨 B2B 센터(b2b@siwonschool.com)로 문의해 주세요.
        </main>
      </>
    );
  }

  // 이 회사의 오픈된(비테스트) 과정 전체
  const { data: courses } = await admin
    .from("courses")
    .select("id, name, code, language, textbook, class_type, format, capacity, start_date, end_date, weekdays, class_time, day_times, duration_min, total_sessions")
    .eq("company_name", company)
    .eq("is_test", false)
    .order("start_date", { ascending: false });
  const courseIds = (courses ?? []).map((c: any) => c.id);

  const teacherNames = new Map<string, string[]>();
  const studentsByCourse = new Map<string, string[]>();
  const studentInfo = new Map<string, { name: string; english_name: string | null }>();
  type Stat = { done: number; attended: number; held: number };
  const stat = new Map<string, Stat>(); // courseId|studentId
  const surveyAvg = new Map<string, { avg: number; count: number }>();

  if (courseIds.length > 0) {
    const [{ data: cts }, { data: css }, { data: bks }, { data: svs }] = await Promise.all([
      admin.from("course_teachers").select("course_id, teacher_id").in("course_id", courseIds).is("assigned_until", null),
      admin.from("course_students").select("course_id, student_id").in("course_id", courseIds),
      admin.from("bookings").select("id, course_id, student_id, end_at, status").in("course_id", courseIds).eq("status", "confirmed"),
      admin.from("survey_responses").select("course_id, rating").in("course_id", courseIds),
    ]);

    const tIds = Array.from(new Set((cts ?? []).map((r: any) => r.teacher_id)));
    if (tIds.length > 0) {
      const { data: tp } = await admin.from("profiles").select("id, name").in("id", tIds);
      const tName = new Map((tp ?? []).map((p: any) => [p.id, p.name]));
      for (const r of cts ?? [])
        (teacherNames.get(r.course_id) ?? teacherNames.set(r.course_id, []).get(r.course_id)!)
          .push(tName.get(r.teacher_id) ?? "—");
    }

    const sIds = Array.from(new Set((css ?? []).map((r: any) => r.student_id)));
    if (sIds.length > 0) {
      const { data: sp } = await admin.from("profiles").select("id, name, english_name").in("id", sIds);
      for (const p of sp ?? []) studentInfo.set(p.id, { name: p.name, english_name: p.english_name ?? null });
    }
    for (const r of css ?? [])
      (studentsByCourse.get(r.course_id) ?? studentsByCourse.set(r.course_id, []).get(r.course_id)!)
        .push(r.student_id);

    // 지난 수업 + 출석 (출석률 = 참여(정시+지각) / 진행 수업, 리스케줄·기타 제외)
    const now = Date.now();
    const pastBookings = (bks ?? []).filter((b: any) => new Date(b.end_at).getTime() <= now);
    const attByBooking = new Map<string, string>();
    const pastIds = pastBookings.map((b: any) => b.id);
    for (let i = 0; i < pastIds.length; i += 100) {
      const { data: atts } = await admin
        .from("attendance").select("booking_id, status").in("booking_id", pastIds.slice(i, i + 100));
      for (const a of atts ?? []) attByBooking.set(a.booking_id, a.status);
    }
    for (const b of pastBookings) {
      const key = `${b.course_id}|${b.student_id}`;
      const s = stat.get(key) ?? { done: 0, attended: 0, held: 0 };
      s.done++;
      const a = attByBooking.get(b.id);
      if (a !== "reschedule" && a !== "other") {
        s.held++;
        if (a === "present" || a === "late") s.attended++;
      }
      stat.set(key, s);
    }

    const byCourse = new Map<string, number[]>();
    for (const r of svs ?? [])
      (byCourse.get(r.course_id) ?? byCourse.set(r.course_id, []).get(r.course_id)!).push(r.rating);
    for (const [cid, list] of byCourse)
      surveyAvg.set(cid, { avg: Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10, count: list.length });
  }

  const data: CompanyCourseData[] = (courses ?? []).map((c: any) => {
    const schedule = (() => {
      const days = (c.weekdays ?? []) as string[];
      if (days.length === 0) return null;
      const dt = c.day_times as Record<string, string> | null;
      if (dt && days.some((d) => dt[d])) {
        const uniq = new Set(days.map((d) => (dt[d] ?? c.class_time ?? "").slice(0, 5)));
        if (uniq.size > 1)
          return days.map((d) => `${WD_KO[d] ?? d} ${(dt[d] ?? c.class_time ?? "").slice(0, 5)}`).join(" · ");
      }
      const time = (c.class_time ?? "").slice(0, 5);
      return `${days.map((d) => WD_KO[d] ?? d).join("·")}${time ? " " + time : ""}`;
    })();
    return {
      id: c.id,
      name: c.name,
      code: c.code ?? null,
      language: c.language ?? null,
      textbook: c.textbook ?? null,
      class_type_ko: c.class_type ? classTypeKo(c.class_type) : null,
      format: c.format ? (c.format === "online" ? "온라인" : "오프라인") : null,
      capacity: c.capacity ?? null,
      start_date: c.start_date ?? null,
      end_date: c.end_date ?? null,
      schedule,
      duration_min: c.duration_min ?? null,
      total_sessions: c.total_sessions ?? null,
      teachers: teacherNames.get(c.id) ?? [],
      surveyAvg: surveyAvg.get(c.id) ?? null,
      students: (studentsByCourse.get(c.id) ?? []).map((sid) => {
        const info = studentInfo.get(sid);
        const s = stat.get(`${c.id}|${sid}`);
        return {
          id: sid,
          name: info?.name ?? "—",
          english_name: info?.english_name ?? null,
          done: s?.done ?? 0,
          rate: s && s.held > 0 ? Math.round((s.attended / s.held) * 100) : null,
        };
      }).sort((a, b) => a.name.localeCompare(b.name, "ko")),
    };
  });

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">{company} 교육 현황</h1>
          <p className="text-sm text-slate-500">
            {company}(으)로 개설된 전체 과정입니다. 과정을 클릭하면 상세 정보와 교육생별 출석률이 표시됩니다.
            (읽기 전용 · 문의 b2b@siwonschool.com)
          </p>
        </header>
        <CompanyPortalClient courses={data} />
      </main>
    </>
  );
}
