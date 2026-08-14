"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface SManageStudent {
  id: string;
  name: string;
  username: string;
  company_name: string | null;
  course_name: string | null;
  course_ids: string[];
}
export interface SManageCourse {
  id: string;
  name: string;
  company_name: string | null;
  stats: { students: number; bookings: number; attended: number; markedTotal: number };
}

export default function StudentManageClient({
  students,
  courses,
}: {
  students: SManageStudent[];
  courses: SManageCourse[];
}) {
  const [courseId, setCourseId] = useState<string>("all"); // "all" | course id
  const [q, setQ] = useState("");

  // 현재 스코프 학생
  const scoped = useMemo(() => {
    const base =
      courseId === "all"
        ? students
        : students.filter((s) => s.course_ids.includes(courseId));
    const s = q.trim().toLowerCase();
    return s
      ? base.filter(
          (r) =>
            r.name.toLowerCase().includes(s) ||
            r.username.toLowerCase().includes(s) ||
            (r.company_name ?? "").toLowerCase().includes(s),
        )
      : base;
  }, [students, courseId, q]);

  // 대시보드 (선택 과정 or 전체)
  const dash = useMemo(() => {
    if (courseId === "all") {
      const enrolled = students.filter((s) => s.course_ids.length > 0).length;
      const agg = courses.reduce(
        (a, c) => ({
          bookings: a.bookings + c.stats.bookings,
          attended: a.attended + c.stats.attended,
          marked: a.marked + c.stats.markedTotal,
        }),
        { bookings: 0, attended: 0, marked: 0 },
      );
      return {
        title: "전체",
        studentCount: students.length,
        sub: `과정 등록 ${enrolled}명`,
        bookings: agg.bookings,
        rate: agg.marked > 0 ? Math.round((agg.attended / agg.marked) * 100) : null,
      };
    }
    const c = courses.find((x) => x.id === courseId)!;
    return {
      title: c.name,
      studentCount: c.stats.students,
      sub: c.company_name ?? "",
      bookings: c.stats.bookings,
      rate: c.stats.markedTotal > 0 ? Math.round((c.stats.attended / c.stats.markedTotal) * 100) : null,
    };
  }, [courseId, courses, students]);

  return (
    <div className="space-y-5">
      {/* 과정 필터 탭 */}
      <div className="flex flex-wrap gap-1.5">
        <FilterTab active={courseId === "all"} onClick={() => setCourseId("all")}>전체</FilterTab>
        {courses.map((c) => (
          <FilterTab key={c.id} active={courseId === c.id} onClick={() => setCourseId(c.id)}>
            {c.name}
          </FilterTab>
        ))}
      </div>

      {/* 대시보드 (선택에 따라 변경) */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="교육생 수" value={String(dash.studentCount)} sub={dash.sub} />
        <Stat label="예약 수업" value={String(dash.bookings)} />
        <Stat label="평균 출석율" value={dash.rate != null ? `${dash.rate}%` : "—"} sub={dash.rate == null ? "체크 전" : undefined} highlight />
        <Stat label="선택" value={dash.title === "전체" ? "전체" : "과정별"} sub={dash.title !== "전체" ? dash.title : undefined} />
      </section>

      {/* 검색 */}
      <input className="input" placeholder="이름 / 아이디 / 회사 검색" value={q} onChange={(e) => setQ(e.target.value)} />

      {/* 학생 목록 */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">교육생</th>
              <th className="px-4 py-2">회사</th>
              <th className="px-4 py-2">과정</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {scoped.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">해당 없음</td></tr>
            )}
            {scoped.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-800">{s.name}</span>
                  <span className="ml-2 text-xs text-slate-400">@{s.username}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{s.company_name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{s.course_name ?? (s.course_ids.length ? `${s.course_ids.length}개 과정` : "—")}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/progress/${s.id}`}
                    className="rounded-md border border-brand-300 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
                    대시보드 →
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

function FilterTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={"rounded-full px-3 py-1.5 text-xs font-medium transition " +
        (active ? "bg-brand-600 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50")}>
      {children}
    </button>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={"rounded-lg p-3 " + (highlight ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-700")}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="mt-1 truncate text-xl font-bold">{value}</div>
      {sub && <div className="truncate text-[11px] opacity-60">{sub}</div>}
    </div>
  );
}
