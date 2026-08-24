import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import { closedRounds, surveyRounds } from "@/lib/survey";
import { getMyTeachingEval } from "@/lib/actions/teacher-eval";

export const dynamic = "force-dynamic";

/** Teaching Feedback — 강사가 받은 만족도 설문 결과(익명)를 과정별로 열람. */
export default async function TeacherFeedbackListPage() {
  const profile = await requireRole(["teacher", "admin"]);
  const supabase = createClient();

  const { data: cts } = await supabase
    .from("course_teachers")
    .select("course_id")
    .eq("teacher_id", profile.id)
    .is("assigned_until", null);
  const courseIds = Array.from(new Set((cts ?? []).map((r: any) => r.course_id)));

  let courses: any[] = [];
  if (courseIds.length > 0) {
    const { data: cs } = await supabase
      .from("courses")
      .select("id, name, company_name, start_date, end_date")
      .in("id", courseIds)
      .order("name");
    courses = cs ?? [];
  }

  // Feedback on My Teaching — 교육생 강사평가(1~10) 익명 취합: 반별 평균 + 코멘트 전체
  const myEval = await getMyTeachingEval(profile.id);

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">Teaching Feedback</h1>
          <p className="text-sm text-slate-500">
            Anonymous student satisfaction survey results, delivered after each survey window closes
            (10% · 50% · Final, each open for 7 days).
          </p>
        </header>

        {/* Feedback on My Teaching — 익명 강사평가 (반별 평균 + 코멘트) */}
        <section className="card mb-6">
          <h2 className="text-base font-semibold text-slate-800">Feedback on My Teaching</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Anonymous ratings (1–10) your students left about your teaching — average per class, with all comments shown.
          </p>
          {myEval.length === 0 || myEval.every((g) => g.count === 0 && g.comments.length === 0) ? (
            <p className="mt-3 py-3 text-center text-sm text-slate-400">No ratings yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {myEval.map((g, i) => (
                <div key={i} className="rounded-md border border-slate-200">
                  <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2">
                    <span className="text-sm font-semibold text-slate-800">{g.course}</span>
                    <span className="text-xs text-slate-500">
                      {g.count} rating{g.count === 1 ? "" : "s"}
                      {g.avg != null && <> · avg <b className="text-amber-700">{g.avg}</b>/10</>}
                    </span>
                  </header>
                  {g.comments.length > 0 ? (
                    <ul className="space-y-1.5 p-3">
                      {g.comments.map((cm, j) => (
                        <li key={j} className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          {cm}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="p-3 text-center text-xs text-slate-400">No comments.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <h2 className="mb-2 text-base font-semibold text-slate-800">Survey Results by Course</h2>
        {courses.length === 0 ? (
          <div className="card text-center text-sm text-slate-400">No assigned courses yet.</div>
        ) : (
          <ul className="space-y-2">
            {courses.map((c) => {
              const delivered = closedRounds(c.start_date, c.end_date).length;
              const total = surveyRounds(c.start_date, c.end_date).length;
              return (
                <li key={c.id}>
                  <Link
                    href={`/teacher/feedback/${c.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 transition hover:border-brand-300 hover:shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-800">{c.name}</div>
                      <div className="text-xs text-slate-400">
                        {c.company_name ?? "—"} · {c.start_date ?? "?"} ~ {c.end_date ?? "?"}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">
                      {delivered}/{total || 3} delivered · Open ›
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
