"use client";

// 센터용 점수 대시보드 — 과정별 Initial vs Final 평가 비교 (그룹 평균 + 개인별).
// 기업관리 페이지에서만 노출 (교육생은 볼 수 없음).
import {
  ASSESSMENT_ITEMS,
  categoryAverages,
  proficiencyOf,
  scoredCount,
  totalOf,
} from "@/lib/assessment";
import AssessmentChart from "@/components/AssessmentChart";
import type { AssessmentCourseData } from "@/components/TeacherAssessmentView";

export default function CompanyScoreDashboard({ courses }: { courses: AssessmentCourseData[] }) {
  const withData = courses.filter((c) =>
    c.students.some((s) => {
      const r = c.records[s.id];
      return (r?.initial && scoredCount(r.initial.scores) > 0) || (r?.final && scoredCount(r.final.scores) > 0);
    }),
  );

  return (
    <section className="card mb-6">
      <h2 className="mb-1 text-base font-semibold">점수 대시보드 (Score Dashboard)</h2>
      <p className="mb-3 text-xs text-slate-500">
        강사가 입력한 Initial / Final 스피킹 평가 비교입니다. 강사·센터만 볼 수 있으며 교육생에게는 표시되지 않습니다.
      </p>

      {withData.length === 0 ? (
        <p className="rounded-md border border-slate-100 bg-slate-50 p-6 text-center text-sm text-slate-400">
          아직 입력된 평가가 없습니다. 강사가 [수업 관리 → Assessment]에서 평가를 입력하면 여기에 표시됩니다.
        </p>
      ) : (
        <div className="space-y-3">
          {withData.map((c, ci) => {
            const initialSets = c.students
              .map((s) => c.records[s.id]?.initial?.scores)
              .filter((x): x is Record<string, number> => !!x && scoredCount(x) > 0);
            const finalSets = c.students
              .map((s) => c.records[s.id]?.final?.scores)
              .filter((x): x is Record<string, number> => !!x && scoredCount(x) > 0);
            const avgI = categoryAverages(initialSets);
            const avgF = categoryAverages(finalSets);
            return (
              <details key={c.id} open={ci === 0} className="rounded-lg border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50">
                  {c.name}
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {c.schedule} · 학생 {c.students.length}명 · Initial {initialSets.length}건 / Final {finalSets.length}건
                  </span>
                </summary>
                <div className="border-t border-slate-100 p-4">
                  {/* 그룹 평균 차트 */}
                  <div className="mb-3 rounded-md border border-slate-100 bg-slate-50/50 p-2">
                    <AssessmentChart
                      initial={avgI}
                      final={avgF}
                      title="카테고리별 그룹 평균 — Initial vs Final"
                      height={220}
                    />
                  </div>

                  {/* 그룹 평균 표 */}
                  <div className="mb-4 overflow-x-auto rounded-md border border-slate-200">
                    <table className="w-full min-w-[480px] text-xs">
                      <thead>
                        <tr className="bg-slate-700 text-white">
                          <th className="px-2 py-1.5 text-left font-semibold">Category</th>
                          <th className="px-2 py-1.5 text-center font-semibold text-sky-200">Initial (Group Avg)</th>
                          <th className="px-2 py-1.5 text-center font-semibold text-orange-200">Final (Group Avg)</th>
                          <th className="px-2 py-1.5 text-center font-semibold">변화</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ASSESSMENT_ITEMS.map((it) => {
                          const i = avgI[it.key];
                          const f = avgF[it.key];
                          const diff = i != null && f != null ? f - i : null;
                          return (
                            <tr key={it.key}>
                              <td className="px-2 py-1.5 text-slate-700">{it.short}</td>
                              <td className="px-2 py-1.5 text-center font-semibold text-sky-700">
                                {i != null ? i.toFixed(1) : "—"}
                              </td>
                              <td className="px-2 py-1.5 text-center font-semibold text-orange-600">
                                {f != null ? f.toFixed(1) : "—"}
                              </td>
                              <td className={"px-2 py-1.5 text-center font-bold " + (diff == null ? "text-slate-300" : diff >= 0 ? "text-emerald-600" : "text-red-500")}>
                                {diff == null ? "—" : `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 개인별 차트 */}
                  <h3 className="mb-2 text-xs font-bold text-slate-600">개인별 Initial vs Final</h3>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {c.students.map((s) => {
                      const r = c.records[s.id];
                      const iS = r?.initial?.scores ?? null;
                      const fS = r?.final?.scores ?? null;
                      const has = (iS && scoredCount(iS) > 0) || (fS && scoredCount(fS) > 0);
                      return (
                        <div key={s.id} className="rounded-md border border-slate-200 p-2">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5 px-1">
                            <span className="text-xs font-bold text-slate-800">{s.name}</span>
                            {iS && scoredCount(iS) > 0 && (
                              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                                Initial {totalOf(iS)}점 · {proficiencyOf(iS)}
                              </span>
                            )}
                            {fS && scoredCount(fS) > 0 && (
                              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                                Final {totalOf(fS)}점 · {proficiencyOf(fS)}
                              </span>
                            )}
                          </div>
                          {has ? (
                            <AssessmentChart initial={iS} final={fS} height={180} />
                          ) : (
                            <p className="px-1 pb-2 text-[11px] text-slate-400">아직 평가 전입니다.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
