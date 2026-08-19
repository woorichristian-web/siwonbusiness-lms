"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { getStudentCourseReport } from "@/lib/actions/student-report";
import { buildStudentCourseXlsx } from "@/lib/reportXlsx";

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
  const [dlPending, startDl] = useTransition();
  const [dlErr, setDlErr] = useState<string | null>(null);
  function download() {
    setDlErr(null);
    startDl(async () => {
      const r = await getStudentCourseReport();
      if (!r.ok) { setDlErr(r.error); return; }
      buildStudentCourseXlsx(r.data);
    });
  }

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

      {/* 검색 + 다운로드 */}
      <div className="flex flex-wrap items-center gap-2">
        <input className="input flex-1" placeholder="이름 / 아이디 / 회사 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn whitespace-nowrap" disabled={dlPending} onClick={download}>
          {dlPending ? "생성 중..." : "교육생 엑셀"}
        </button>
      </div>
      {dlErr && <p className="text-xs text-red-600">{dlErr}</p>}
      <p className="-mt-3 text-xs text-slate-400">
        엑셀: [종합] 교육생별 합산 + 기업별 시트(강좌별 명단·출석율). 파일명·문서 상단에 다운로드 날짜 기재.
      </p>

      {/* 과정별 그룹 목록 */}
      {(() => {
        const visible = courseId === "all" ? courses : courses.filter((c) => c.id === courseId);
        const groups = visible.map((c) => ({
          course: c,
          list: scoped.filter((s) => s.course_ids.includes(c.id)),
        })).filter((g) => g.list.length > 0);
        const grouped = new Set(groups.flatMap((g) => g.list.map((s) => s.id)));
        const rest = courseId === "all" ? scoped.filter((s) => !grouped.has(s.id)) : [];
        const blocks = [
          ...groups.map((g) => ({ key: g.course.id, title: g.course.name, company: g.course.company_name, list: g.list })),
          ...(rest.length ? [{ key: "__none__", title: "과정 미배정", company: null as string | null, list: rest }] : []),
        ];
        if (blocks.length === 0)
          return <div className="card text-center text-sm text-slate-400">해당 없음</div>;
        return blocks.map((b) => (
          <section key={b.key} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <header className="border-b border-slate-100 bg-gradient-to-r from-brand-50 to-white px-4 py-3">
              <h3 className="font-semibold text-brand-900">
                {b.key === "__none__" ? "과정 미배정" : `${b.title}`}
                {b.company && <span className="ml-2 text-sm font-normal text-slate-500">· {b.company}</span>}
                <span className="ml-2 text-xs font-normal text-slate-400">교육생 {b.list.length}명</span>
              </h3>
            </header>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">교육생</th>
                  <th className="px-4 py-2">회사</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {b.list.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">{s.name}</span>
                      <span className="ml-2 text-xs text-slate-400">@{s.username}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.company_name ?? "—"}</td>
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
          </section>
        ));
      })()}
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
