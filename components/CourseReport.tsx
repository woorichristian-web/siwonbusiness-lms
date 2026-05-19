"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import type { CourseReportData } from "@/lib/course-report";

export default function CourseReport({ data }: { data: CourseReportData }) {
  const hasFeedback = data.areaComparison.some(
    (a) => a.initial != null || a.final != null
  );

  // Chart data — initial vs final per area (only areas with at least one value)
  const compareData = data.areaComparison
    .filter((a) => a.initial != null || a.final != null)
    .map((a) => ({
      label: a.label,
      Initial: a.initial,
      Final: a.final,
      color: a.color,
    }));

  // Delta data (improvement per area)
  const deltaData = data.areaComparison
    .filter((a) => a.delta != null)
    .map((a) => ({
      label: a.label,
      delta: a.delta!,
      color: a.color,
    }));

  return (
    <div className="space-y-6">
      {/* Top summary */}
      <section className="card">
        <h2 className="mb-3 text-base font-semibold text-slate-800">📊 강좌 요약</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="등록 교육생" value={`${data.studentCount}명`} />
          <Stat label="총 차시" value={data.totalSessions != null ? `${data.totalSessions}차시` : "—"} />
          <Stat label="예약된 수업" value={String(data.totalConfirmed)} />
          <Stat
            label="평균 출석률"
            value={data.attendanceRate != null ? `${data.attendanceRate}%` : "—"}
            highlight
          />
        </div>
      </section>

      {/* Attendance progress bar */}
      <section className="card">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">전체 평균 출석률</h3>
          <span className="text-sm text-slate-500">
            {data.attendanceRate != null
              ? `${data.attendanceRate}% (출석 ${data.totalAttended}회 / 결석 ${data.totalAbsent}회)`
              : "출석 기록 없음"}
          </span>
        </header>
        <div className="h-4 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={
              "h-full transition-all " +
              ((data.attendanceRate ?? 0) >= 80
                ? "bg-emerald-500"
                : (data.attendanceRate ?? 0) >= 60
                  ? "bg-amber-500"
                  : "bg-red-500")
            }
            style={{ width: `${data.attendanceRate ?? 0}%` }}
          />
        </div>
      </section>

      {/* Initial vs Final by area */}
      <section className="card">
        <header className="mb-3">
          <h3 className="text-sm font-semibold text-slate-700">
            Initial vs Final (영역별 평균)
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            교육생별 첫 평가(Initial) vs 마지막 평가(Final)의 전체 평균을 영역별로 비교
          </p>
        </header>

        {!hasFeedback ? (
          <p className="text-center text-sm text-slate-400 py-8">
            아직 평가 데이터가 없습니다.
          </p>
        ) : (
          <div className="w-full overflow-x-auto">
            <div style={{ minWidth: 500, height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compareData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => typeof v === "number" ? v.toFixed(2) : v} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Initial" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Final" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* Improvement delta */}
      {deltaData.length > 0 && (
        <section className="card">
          <header className="mb-3">
            <h3 className="text-sm font-semibold text-slate-700">영역별 성장도 (Final − Initial)</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              양수 = 향상, 음수 = 하락. 영역별로 어느 부분이 가장 많이 늘었는지 확인.
            </p>
          </header>
          <div className="w-full overflow-x-auto">
            <div style={{ minWidth: 500, height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deltaData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis domain={[-5, 5]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => typeof v === "number" ? (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)) : v} />
                  <Bar dataKey="delta" radius={[4, 4, 0, 0]}>
                    {deltaData.map((d, i) => (
                      <Cell key={i} fill={d.delta >= 0 ? "#10b981" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* Per-student table */}
      <section className="card">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">교육생별 진척도</h3>
        {data.perStudent.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-6">교육생이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">이름</th>
                  <th className="px-3 py-2 text-center">수강 횟수</th>
                  <th className="px-3 py-2 text-center">평가 횟수</th>
                  <th className="px-3 py-2 text-center">Initial</th>
                  <th className="px-3 py-2 text-center">Final</th>
                  <th className="px-3 py-2 text-center">Δ (성장)</th>
                  <th className="px-3 py-2 text-right">상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.perStudent.map((s) => (
                  <tr key={s.studentId}>
                    <td className="px-3 py-2 font-medium text-slate-800">{s.studentName}</td>
                    <td className="px-3 py-2 text-center">{s.sessions}</td>
                    <td className="px-3 py-2 text-center">{s.feedbackCount}</td>
                    <td className="px-3 py-2 text-center text-slate-600">
                      {s.initialAvg != null ? s.initialAvg.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-800 font-medium">
                      {s.finalAvg != null ? s.finalAvg.toFixed(2) : "—"}
                    </td>
                    <td className={
                      "px-3 py-2 text-center font-bold " +
                      (s.delta == null
                        ? "text-slate-400"
                        : s.delta > 0
                          ? "text-emerald-600"
                          : s.delta < 0
                            ? "text-red-600"
                            : "text-slate-500")
                    }>
                      {s.delta == null ? "—" : s.delta > 0 ? `+${s.delta.toFixed(2)}` : s.delta.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <a
                        href={`/admin/progress/${s.studentId}`}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        개별 리포트 →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={"rounded-md p-3 " + (highlight ? "bg-emerald-50" : "bg-slate-50")}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={"mt-1 text-xl font-bold " + (highlight ? "text-emerald-700" : "text-slate-800")}>
        {value}
      </div>
    </div>
  );
}
