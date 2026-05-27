"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { CompanyPerformanceData } from "@/lib/company-performance";

export default function CompanyPerformanceView({
  companyName,
  data,
}: {
  companyName: string;
  data: CompanyPerformanceData;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // 월 선택 UI 상태
  const [year, setYear] = useState(data.year);
  const [month, setMonth] = useState(data.month);

  function applyMonth(y: number, m: number) {
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    router.push(`/admin/companies/${encodeURIComponent(companyName)}?tab=performance&month=${ym}`);
  }

  function download() {
    setBusy(true);
    try {
      const rows = data.sessions.map((s) => ({
        "차시": s.sessionIndex,
        "평균 점수": s.avg,
        "최저 점수": s.min,
        "최고 점수": s.max,
        "측정 학생 수": s.count,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      const sheetName = `${data.year}-${String(data.month).padStart(2, "0")}`;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `성과_${companyName}_${data.year}-${String(data.month).padStart(2, "0")}.xlsx`);
    } finally {
      setBusy(false);
    }
  }

  // 차트 데이터 (recharts 가 잘 다루는 구조로 가공)
  const chartData = data.sessions.map((s) => ({
    label: `차시 ${s.sessionIndex}`,
    avg: s.avg,
    min: s.min,
    max: s.max,
    count: s.count,
  }));

  // 차트 최저값(0)부터 최대값(10)까지 표시
  const yMin = 0;
  const yMax = 10;

  // 현재 연도 기준으로 셀렉트 옵션 만들기
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-6">
      {/* 컨트롤 바 */}
      <section className="card flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-slate-700">월 선택:</label>
        <select
          className="input max-w-[100px]"
          value={year}
          onChange={(e) => { setYear(Number(e.target.value)); applyMonth(Number(e.target.value), month); }}
        >
          {yearOptions.map((y) => <option key={y} value={y}>{y}년</option>)}
        </select>
        <select
          className="input max-w-[80px]"
          value={month}
          onChange={(e) => { setMonth(Number(e.target.value)); applyMonth(year, Number(e.target.value)); }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
            <option key={m} value={m}>{m}월</option>
          ))}
        </select>
        <span className="text-xs text-slate-400">
          · 교육생 <b>{data.totalStudents}</b>명 · 평가 <b>{data.totalFeedback}</b>건
        </span>
        <button
          type="button"
          className="btn ml-auto"
          onClick={download}
          disabled={busy || data.sessions.length === 0}
        >
          ⬇ 월별 Excel 다운로드
        </button>
      </section>

      {/* 차트 */}
      <section className="card">
        <header className="mb-3">
          <h3 className="text-sm font-semibold text-slate-700">
            {data.year}년 {data.month}월 평균 성과
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            그 달 안에 진행된 수업 차시별로 모든 교육생의 평균 점수를 표시합니다.
            연한 영역은 그 시점 교육생들의 최저~최고 점수 범위.
          </p>
        </header>

        {data.sessions.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            이 달에는 평가된 수업이 없습니다.
          </p>
        ) : (
          <div className="w-full overflow-x-auto">
            <div style={{ minWidth: Math.max(480, chartData.length * 80), height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => typeof v === "number" ? v.toFixed(2) : v} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />

                  {/* 최고 점수 (점선) */}
                  <Line
                    type="monotone"
                    dataKey="max"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={{ r: 3 }}
                    name="최고"
                  />
                  {/* 평균 라인 (메인) */}
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="#1d4ed8"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="평균"
                  />
                  {/* 최저 점수 (점선) */}
                  <Line
                    type="monotone"
                    dataKey="min"
                    stroke="#ef4444"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={{ r: 3 }}
                    name="최저"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* 표 (보조) */}
      {data.sessions.length > 0 && (
        <section className="card">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">차시별 상세</h3>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">차시</th>
                  <th className="px-3 py-2">평균 점수</th>
                  <th className="px-3 py-2">최저</th>
                  <th className="px-3 py-2">최고</th>
                  <th className="px-3 py-2">측정 학생 수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.sessions.map((s) => (
                  <tr key={s.sessionIndex}>
                    <td className="px-3 py-2 font-medium text-slate-800">{s.sessionIndex}차시</td>
                    <td className="px-3 py-2 font-bold text-brand-700">{s.avg.toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-600">{s.min.toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-600">{s.max.toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-600">{s.count}명</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
