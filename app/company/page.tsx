import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { classTypeKo } from "@/lib/types";
import AppHeader from "@/components/AppHeader";

export const dynamic = "force-dynamic";

const WD_KO: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };

// 기업 담당자(마스터 계정) 전용 — 자기 회사 교육 현황 읽기 전용 대시보드.
// 데이터는 서버에서 회사명으로 필터해 제공하므로 다른 회사 정보는 접근 불가.
export default async function CompanyPortalPage() {
  const profile = await requireRole(["company"]);
  const admin = createAdminClient();
  const company = profile.company_name;

  if (!company) {
    return (
      <>
        <AppHeader profile={profile} />
        <main className="mx-auto max-w-4xl px-4 py-10 text-center text-sm text-slate-500">
          이 계정에 연결된 회사가 없습니다. 시원스쿨 B2B 센터(b2b@siwonschool.com)로 문의해 주세요.
        </main>
      </>
    );
  }

  // 이 회사의 오픈된(비테스트) 과정
  const { data: courses } = await admin
    .from("courses")
    .select("id, name, code, language, textbook, class_type, format, start_date, end_date, weekdays, class_time, day_times, duration_min, total_sessions")
    .eq("company_name", company)
    .eq("is_test", false)
    .order("start_date", { ascending: false });
  const courseIds = (courses ?? []).map((c: any) => c.id);

  // 배정 강사
  const teacherNames = new Map<string, string[]>();
  // 과정별 교육생
  const studentsByCourse = new Map<string, string[]>();
  const studentInfo = new Map<string, { name: string; english_name: string | null }>();
  // 출석 계산용
  type Stat = { done: number; attended: number; held: number };
  const stat = new Map<string, Stat>(); // key: courseId|studentId
  // 만족도 평균 (과정별)
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

    // 지난 수업 + 출석
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

    // 만족도 평균
    const byCourse = new Map<string, number[]>();
    for (const r of svs ?? [])
      (byCourse.get(r.course_id) ?? byCourse.set(r.course_id, []).get(r.course_id)!).push(r.rating);
    for (const [cid, list] of byCourse)
      surveyAvg.set(cid, { avg: Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10, count: list.length });
  }

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">{company} 교육 현황</h1>
          <p className="text-sm text-slate-500">
            시원스쿨 B2B 출강 교육 현황입니다. (읽기 전용 · 문의 b2b@siwonschool.com)
          </p>
        </header>

        {(courses ?? []).length === 0 ? (
          <div className="card text-center text-sm text-slate-400">진행 중인 과정이 없습니다.</div>
        ) : (
          <div className="space-y-6">
            {(courses ?? []).map((c: any) => {
              const students = studentsByCourse.get(c.id) ?? [];
              const sv = surveyAvg.get(c.id);
              const schedule = (() => {
                const days = (c.weekdays ?? []) as string[];
                if (days.length === 0) return null;
                const dt = c.day_times as Record<string, string> | null;
                if (dt && days.some((d) => dt[d])) {
                  const uniq = new Set(days.map((d) => (dt[d] ?? c.class_time ?? "").slice(0, 5)));
                  if (uniq.size > 1)
                    return days.map((d) => `${WD_KO[d] ?? d} ${(dt[d] ?? c.class_time ?? "").slice(0, 5)}`).join(" · ");
                }
                return `${days.map((d) => WD_KO[d] ?? d).join("·")} ${(c.class_time ?? "").slice(0, 5)}`;
              })();
              return (
                <section key={c.id} className="card">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-slate-800">{c.name}</h2>
                    {c.code && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">{c.code}</span>
                    )}
                    {sv && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        만족도 {sv.avg}/10 · {sv.count}건
                      </span>
                    )}
                  </div>
                  <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {c.language && <span>{c.language}</span>}
                    {c.textbook && <span>교재 {c.textbook}</span>}
                    {c.class_type && <span>{classTypeKo(c.class_type)}</span>}
                    {c.format && <span>{c.format === "online" ? "온라인" : "오프라인"}</span>}
                    <span>기간 {c.start_date ?? "?"} ~ {c.end_date ?? "?"}</span>
                    {schedule && <span>{schedule}{c.duration_min ? ` · ${c.duration_min}분` : ""}</span>}
                    {c.total_sessions != null && <span>총 {c.total_sessions}차시</span>}
                    <span>강사 {(teacherNames.get(c.id) ?? []).join(", ") || "미배정"}</span>
                  </div>

                  {students.length === 0 ? (
                    <p className="py-3 text-center text-sm text-slate-400">등록된 교육생이 없습니다.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-slate-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                            <th className="px-3 py-2">이름</th>
                            <th className="px-3 py-2">영어 이름</th>
                            <th className="px-3 py-2 text-center">진행 차시</th>
                            <th className="px-3 py-2 text-center">출석률</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((sid) => {
                            const info = studentInfo.get(sid);
                            const s = stat.get(`${c.id}|${sid}`);
                            const rate = s && s.held > 0 ? Math.round((s.attended / s.held) * 100) : null;
                            return (
                              <tr key={sid} className="border-b border-slate-100 last:border-b-0">
                                <td className="px-3 py-2 font-medium text-slate-800">{info?.name ?? "—"}</td>
                                <td className="px-3 py-2 text-slate-500">{info?.english_name ?? "—"}</td>
                                <td className="px-3 py-2 text-center text-slate-600">
                                  {s?.done ?? 0}{c.total_sessions != null ? ` / ${c.total_sessions}` : ""}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {rate != null ? (
                                    <span className={"font-semibold " + (rate >= 80 ? "text-emerald-600" : rate >= 50 ? "text-amber-600" : "text-red-500")}>
                                      {rate}%
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
