"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { getTeacherPayrollReport } from "@/lib/actions/teacher-report";
import { buildTeacherPayrollXlsx } from "@/lib/reportXlsx";

export interface TeacherRow {
  id: string;
  name: string;
  username: string;
  classes: number;
  courses: number;
  ratingAvg: number | null;
  ratingCount: number;
}
export interface TeacherGroup {
  key: string;
  title: string;        // 과정명 (미배정 그룹은 "미배정 강사")
  company: string | null;
  teachers: TeacherRow[];
}
interface Dashboard {
  teacherCount: number;
  avgSatisfaction: number | null;
  ratingCount: number;
  totalCourses: number;
  totalClasses: number;
}

export default function TeacherManageList({
  groups,
  dashboard,
}: {
  groups: TeacherGroup[];
  dashboard: Dashboard;
}) {
  const [q, setQ] = useState("");
  const [dlPending, startDl] = useTransition();
  const [dlErr, setDlErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return groups;
    return groups
      .map((g) => ({
        ...g,
        teachers: g.teachers.filter(
          (r) => r.name.toLowerCase().includes(s) || r.username.toLowerCase().includes(s),
        ),
      }))
      .filter((g) => g.teachers.length > 0);
  }, [groups, q]);

  function download() {
    setDlErr(null);
    startDl(async () => {
      const r = await getTeacherPayrollReport();
      if (!r.ok) { setDlErr(r.error); return; }
      buildTeacherPayrollXlsx(r.data);
    });
  }

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

      {/* 검색 + 다운로드 */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input flex-1"
          placeholder="강사 이름 / 아이디 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn whitespace-nowrap" disabled={dlPending} onClick={download}>
          {dlPending ? "생성 중..." : "📥 강사 정산 엑셀"}
        </button>
      </div>
      {dlErr && <p className="text-xs text-red-600">{dlErr}</p>}
      <p className="-mt-3 text-xs text-slate-400">
        엑셀: [종합] 강사별 합산 정산액 + 기업별 시트(강좌별 강사 정보·페이롤). 파일명·문서 상단에 다운로드 날짜 기재.
      </p>

      {/* 과정별 그룹 */}
      {filtered.length === 0 ? (
        <div className="card text-center text-sm text-slate-400">검색 결과 없음</div>
      ) : (
        filtered.map((g) => (
          <section key={g.key} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <header className="border-b border-slate-100 bg-gradient-to-r from-brand-50 to-white px-4 py-3">
              <h3 className="font-semibold text-brand-900">
                {g.title === "미배정 강사" ? "👤 미배정 강사" : `📘 ${g.title}`}
                {g.company && <span className="ml-2 text-sm font-normal text-slate-500">· {g.company}</span>}
                <span className="ml-2 text-xs font-normal text-slate-400">강사 {g.teachers.length}명</span>
              </h3>
            </header>
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
                {g.teachers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">{t.name}</span>
                      <span className="ml-2 text-xs text-slate-400">@{t.username}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.ratingAvg != null ? (
                        <span className="font-semibold text-amber-700">
                          ⭐ {t.ratingAvg}
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
          </section>
        ))
      )}
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
