"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface TeacherRow {
  id: string;
  name: string;
  username: string;
  classes: number;
  courses: number;
  ratingAvg: number | null;
  ratingCount: number;
}
interface Dashboard {
  teacherCount: number;
  avgSatisfaction: number | null;
  ratingCount: number;
  totalCourses: number;
  totalClasses: number;
}

export default function TeacherManageList({
  rows,
  dashboard,
}: {
  rows: TeacherRow[];
  dashboard: Dashboard;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s
      ? rows.filter((r) => r.name.toLowerCase().includes(s) || r.username.toLowerCase().includes(s))
      : rows;
  }, [rows, q]);

  return (
    <div className="space-y-5">
      {/* 대시보드 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="강사 수" value={String(dashboard.teacherCount)} />
        <Stat
          label="평균 만족도"
          value={dashboard.avgSatisfaction != null ? `${dashboard.avgSatisfaction}/10` : "—"}
          sub={dashboard.ratingCount > 0 ? `${dashboard.ratingCount}건` : "평가 없음"}
          highlight
        />
        <Stat label="운영 과정" value={String(dashboard.totalCourses)} />
        <Stat label="누적 진행 수업" value={String(dashboard.totalClasses)} />
      </section>

      {/* 검색 */}
      <input
        className="input"
        placeholder="강사 이름 / 아이디 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {/* 목록 */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">강사</th>
              <th className="px-4 py-2 text-right">만족도</th>
              <th className="px-4 py-2 text-right">담당 과정</th>
              <th className="px-4 py-2 text-right">진행 수업</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">검색 결과 없음</td></tr>
            )}
            {filtered.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-800">{t.name}</span>
                  <span className="ml-2 text-xs text-slate-400">@{t.username}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {t.ratingAvg != null ? (
                    <span className="font-semibold text-amber-700">⭐ {t.ratingAvg}
                      <span className="ml-1 text-xs font-normal text-slate-400">({t.ratingCount})</span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-slate-700">{t.courses}</td>
                <td className="px-4 py-3 text-right text-slate-700">{t.classes}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/teachers/${t.id}`}
                    className="rounded-md border border-brand-300 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
                    상세 →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  label, value, sub, highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={"rounded-lg p-3 " + (highlight ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-700")}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      {sub && <div className="text-[11px] opacity-60">{sub}</div>}
    </div>
  );
}
