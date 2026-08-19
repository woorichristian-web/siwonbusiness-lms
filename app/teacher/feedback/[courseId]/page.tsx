import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import { surveyRounds } from "@/lib/survey";
import { getSurveyAggregate } from "@/lib/actions/survey";

export const dynamic = "force-dynamic";

export default async function TeacherFeedbackCoursePage({
  params,
}: {
  params: { courseId: string };
}) {
  const profile = await requireRole(["teacher", "admin"]);
  const supabase = createClient();

  // 담당 과정인지 확인 (익명성: 응답 원본은 조회하지 않고 집계만 사용)
  const { data: link } = await supabase
    .from("course_teachers")
    .select("id")
    .eq("course_id", params.courseId)
    .eq("teacher_id", profile.id)
    .maybeSingle();

  const { data: course } = await supabase
    .from("courses")
    .select("id, name, company_name, start_date, end_date")
    .eq("id", params.courseId)
    .maybeSingle();

  if (!course || (!link && profile.role !== "admin")) {
    return (
      <>
        <AppHeader profile={profile} />
        <main className="mx-auto max-w-3xl px-4 py-10 text-center text-sm text-slate-500">
          Course not found or not assigned to you.
          <div className="mt-3"><Link href="/teacher/feedback" className="text-brand-700 underline">← Teaching Feedback</Link></div>
        </main>
      </>
    );
  }

  const now = new Date();
  const rounds = surveyRounds(course.start_date, course.end_date);
  const items = await Promise.all(
    rounds.map(async (r) => {
      const closed = now >= r.close;
      const agg = closed ? await getSurveyAggregate(course.id, r.round) : null;
      return { ...r, closed, agg };
    }),
  );

  const fmt = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <div>
          <Link href="/teacher/feedback" className="text-xs text-slate-400 hover:underline">← Teaching Feedback</Link>
          <h1 className="mt-1 text-xl font-bold text-slate-800">{course.name}</h1>
          <p className="text-sm text-slate-500">
            {course.company_name ?? "—"} · {course.start_date ?? "?"} ~ {course.end_date ?? "?"} · results are anonymous
          </p>
        </div>

        {items.length === 0 && (
          <div className="card text-center text-sm text-slate-400">
            Survey schedule is not available (course period not set).
          </div>
        )}

        {items.map((it) => (
          <section key={it.round} className="card">
            <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-800">
                {it.label === "10%" ? "Survey 1 — Early (10%)" : it.label === "50%" ? "Survey 2 — Midpoint (50%)" : "Survey 3 — Final"}
              </h2>
              {it.closed && it.agg ? (
                <span className="text-xs text-slate-400">Delivered {fmt(it.close)}</span>
              ) : now >= it.open ? (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  In progress — closes {fmt(it.close)}
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
                  Opens {fmt(it.open)}
                </span>
              )}
            </header>

            {it.closed && it.agg ? (
              it.agg.count === 0 ? (
                <p className="py-3 text-center text-sm text-slate-400">No responses were submitted.</p>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="rounded-md bg-amber-50 px-4 py-2 text-center">
                      <div className="text-2xl font-bold text-amber-700">{it.agg.avg}<span className="text-sm font-normal text-slate-400"> / 10</span></div>
                      <div className="text-[10px] text-slate-500">Average rating</div>
                    </div>
                    <div className="text-sm text-slate-500">{it.agg.count} response{it.agg.count === 1 ? "" : "s"}</div>
                  </div>
                  {it.agg.comments.length > 0 ? (
                    <ul className="space-y-2">
                      {it.agg.comments.map((cm, i) => (
                        <li key={i} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                          {cm}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">No written comments in this round.</p>
                  )}
                </>
              )
            ) : (
              <p className="py-2 text-sm text-slate-400">
                Results are delivered here once the response window ends.
              </p>
            )}
          </section>
        ))}
      </main>
    </>
  );
}
