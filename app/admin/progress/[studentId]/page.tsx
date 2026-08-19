import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getStudentProgress } from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import ProgressReport from "@/components/ProgressReport";
import { getCourseProgressMap, progressLabel } from "@/lib/courseProgress";

export const dynamic = "force-dynamic";

export default async function AdminProgressPage({
  params,
}: {
  params: { studentId: string };
}) {
  const profile = await requireRole(["admin"]);
  const data = await getStudentProgress(params.studentId);

  // 과정 진도 (어디까지·어떤 내용까지 수업했는지)
  const supabase = createClient();
  const { data: enrCp } = await supabase
    .from("course_students")
    .select("course_id")
    .eq("student_id", params.studentId);
  const cpIds = Array.from(new Set((enrCp ?? []).map((r: any) => r.course_id)));
  let courseProgress: { id: string; name: string; company: string | null; label: string; next: string | null }[] = [];
  if (cpIds.length > 0) {
    const [{ data: csCp }, pm] = await Promise.all([
      supabase.from("courses").select("id, name, company_name").in("id", cpIds),
      getCourseProgressMap(supabase, cpIds),
    ]);
    courseProgress = (csCp ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      company: c.company_name ?? null,
      label: progressLabel(pm.get(c.id)),
      next: pm.get(c.id)?.nextTopic ?? null,
    }));
  }

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4">
          <Link href="/admin/users" className="text-sm text-brand-600 hover:underline">
            ← Back to 회원 관리
          </Link>
        </div>
        {data ? (
          <>
            {courseProgress.length > 0 && (
              <section className="card mb-4">
                <h2 className="mb-2 text-sm font-semibold text-slate-700">과정 진도 (수업 내용 기준)</h2>
                <ul className="space-y-1 text-sm">
                  {courseProgress.map((cp) => (
                    <li key={cp.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                      <b>{cp.name}</b>
                      {cp.company ? <span className="text-slate-400"> · {cp.company}</span> : null}
                      <div className="mt-0.5 text-xs text-emerald-700">{cp.label}</div>
                      {cp.next && <div className="text-xs text-slate-400">다음 차시: {cp.next}</div>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <ProgressReport data={data} lang="ko" />
          </>
        ) : (
          <div className="card text-center text-slate-500">교육생을 찾을 수 없습니다.</div>
        )}
      </main>
    </>
  );
}
