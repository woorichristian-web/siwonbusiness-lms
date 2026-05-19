import Link from "next/link";
import type { Profile } from "@/lib/types";

/**
 * Lists contracted courses for a company, grouped by year (most recent first).
 * A "course" = unique combination of (company_name, course_name) among students.
 */
export default function CompanyCoursesList({
  companyName,
  members,
}: {
  companyName: string;
  members: Profile[];
  teachers: Profile[];
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

  const courses: CourseInfo[] = Array.from(byCourse.entries()).map(([name, list]) => {
    // Derive year from earliest course_start_date in the group
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
        <h2 className="font-semibold text-slate-800">📚 계약 강좌</h2>
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
                📅 {year === "—" ? "기간 미지정" : `${year}년`}
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
                            <span>👥 교육생 {c.studentCount}명</span>
                            <span>·</span>
                            <span>📖 {c.totalSessions != null ? `${c.totalSessions}차시` : "차시 미지정"}</span>
                            {c.startDate && c.endDate && (
                              <>
                                <span>·</span>
                                <span>🗓️ {c.startDate} ~ {c.endDate}</span>
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
