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

  // 강사가 남긴 수업 메모 (attendance.notes) — 강사·센터만 열람, 메모가 있는 수업만
  const supabaseMemo = createClient();
  const { data: memoRows } = await supabaseMemo
    .from("attendance")
    .select("status, notes, bookings!inner(student_id, start_at)")
    .eq("bookings.student_id", params.studentId)
    .not("notes", "is", null)
    .order("marked_at", { ascending: false });
  const classMemos = (memoRows ?? [])
    .filter((m: any) => (m.notes ?? "").trim())
    .map((m: any) => ({
      date: m.bookings?.start_at as string,
      status: m.status as string,
      notes: m.notes as string,
    }));

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
            {classMemos.length > 0 && (
              <section className="card mb-4">
                <h2 className="mb-1 text-sm font-semibold text-slate-700">수업 메모 (강사 작성)</h2>
                <p className="mb-2 text-xs text-slate-400">강사와 센터만 볼 수 있으며, 교육생에게는 표시되지 않습니다.</p>
                <ul className="space-y-1.5 text-sm">
                  {classMemos.map((m, i) => (
                    <li key={i} className="rounded-md border border-amber-100 bg-amber-50/50 px-3 py-2">
                      <div className="text-xs text-slate-500">
                        {m.date ? new Date(m.date).toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric", weekday: "short" }) : "—"}
                        <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">{m.status}</span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{m.notes}</p>
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
