import Link from "next/link";
import type { Profile } from "@/lib/types";

/** 과정 관리(courses 테이블)에서 넘어오는 최신 과정 요약 */
export type ManagedCourseSummary = {
  name: string;
  start_date: string | null;
  end_date: string | null;
  total_sessions: number | null;
  studentCount: number;
};

/**
 * Lists contracted courses for a company, grouped by year (most recent first).
 * 과정 관리에 등록된 과정(managedCourses)이 우선 — 항상 최신 정보로 표시.
 * 과정 관리에 없는 옛 강좌만 회원별 legacy 계약 필드에서 파생한다.
 */
export default function CompanyCoursesList({
  companyName,
  members,
  managedCourses = [],
}: {
  companyName: string;
  members: Profile[];
  teachers: Profile[];
  managedCourses?: ManagedCourseSummary[];
}) {
  // Group students by course_name
  const byCourse = new Map<string, Profile[]>();
  for (const m of members) {
    const key = m.course_name || "(강좌 미배정)";
    if (!byCourse.has(key)) byCourse.set(key, []);
    byCourse.get(key)!.push(m);
  }

  // For each course, compute summary
  type CourseInfo = {
    name: string;
    year: string; // derived from course_start_date
    studentCount: number;
    totalSessions: number | null;
    startDate: string | null;
    endDate: string | null;
  };

  // 1) 과정 관리에 등록된 과정 — courses 테이블의 최신 값 그대로
  const managedNames = new Set(managedCourses.map((c) => c.name));
  const fromManaged: CourseInfo[] = managedCourses.map((c) => ({
    name: c.name,
    year: c.start_date ? c.start_date.slice(0, 4) : "—",
    studentCount: c.studentCount,
    totalSessions: c.total_sessions,
    startDate: c.start_date,
    endDate: c.end_date,
  }));

  // 2) 과정 관리에 없는 옛 강좌 — 회원 legacy 계약 필드에서 파생
  const fromLegacy: CourseInfo[] = Array.from(byCourse.entries())
    .filter(([name]) => !managedNames.has(name))
    .map(([name, list]) => {
      const starts = list.map((s) => s.course_start_date).filter(Boolean) as string[];
      const ends = list.map((s) => s.course_end_date).filter(Boolean) as string[];
      const totals = list.map((s) => s.course_total_sessions).filter((v): v is number => typeof v === "number");
      const minStart = starts.length > 0 ? starts.sort()[0] : null;
      const maxEnd = ends.length > 0 ? ends.sort().slice(-1)[0] : null;
      return {
        name,
        year: minStart ? minStart.slice(0, 4) : "—",
        studentCount: list.length,
        totalSessions: totals.length > 0 ? Math.max(...totals) : null,
        startDate: minStart,
        endDate: maxEnd,
      };
    });

  const courses: CourseInfo[] = [...fromManaged, ...fromLegacy];

  // Group by year, sort years descending (most recent first)
  const yearGroups = new Map<string, CourseInfo[]>();
  for (const c of courses) {
    if (!yearGroups.has(c.year)) yearGroups.set(c.year, []);
    yearGroups.get(c.year)!.push(c);
  }
  const yearsSorted = Array.from(yearGroups.entries()).sort(([a], [b]) => {
    if (a === "—") return 1;
    if (b === "—") return -1;
    return b.localeCompare(a); // descending
  });

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-4 py-3">
        <h2 className="font-semibold text-slate-800">계약 강좌</h2>
        <p className="text-xs text-slate-500">최근 연도부터 표시. 강좌를 클릭하면 종합 리포트로 이동합니다.</p>
      </header>

      {courses.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-400">
          아직 배정된 강좌가 없습니다. 회원 편집에서 강좌 정보를 입력해주세요.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {yearsSorted.map(([year, list]) => (
            <div key={year} className="px-4 py-3">
              <h3 className="mb-2 text-sm font-bold text-slate-700">
                {year === "—" ? "기간 미지정" : `${year}년`}
              </h3>
              <ul className="space-y-2">
                {list.map((c) => (
                  <li key={c.name}>
                    <Link
                      href={`/admin/companies/${encodeURIComponent(companyName)}/courses/${encodeURIComponent(c.name)}`}
                      className="block rounded-md border border-slate-200 p-3 transition hover:border-brand-400 hover:bg-brand-50/30"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-slate-800">{c.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>교육생 {c.studentCount}명</span>
                            <span>·</span>
                            <span>{c.totalSessions != null ? `${c.totalSessions}차시` : "차시 미지정"}</span>
                            {c.startDate && c.endDate && (
                              <>
                                <span>·</span>
                                <span>{c.startDate} ~ {c.endDate}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-brand-600">리포트 →</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
