import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import { closedRounds, surveyRounds } from "@/lib/survey";

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
                      📬 {delivered}/{total || 3} delivered · Open ›
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
