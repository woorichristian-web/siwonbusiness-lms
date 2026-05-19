import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import CompanyBoardClient from "@/components/CompanyBoardClient";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminCompaniesBoardPage() {
  const profile = await requireRole(["admin"]);
  const supabase = createClient();

  // 모든 교육생 회원
  const { data: rows } = await supabase
    .from("profiles")
    .select("id, name, role, company_name, course_name, course_total_sessions, course_start_date, course_end_date, created_at")
    .eq("role", "student");

  const allStudents = (rows ?? []) as Profile[];

  // 기업별 집계
  const companyMap = new Map<string, {
    name: string;
    memberCount: number;
    courseCount: number;
    latestCourseDate: string | null;  // 가장 최근 시작일
  }>();

  for (const s of allStudents) {
    const name = s.company_name;
    if (!name) continue;
    const cur = companyMap.get(name) ?? {
      name, memberCount: 0, courseCount: 0, latestCourseDate: null,
    };
    cur.memberCount++;
    if (s.course_start_date) {
      if (!cur.latestCourseDate || s.course_start_date > cur.latestCourseDate) {
        cur.latestCourseDate = s.course_start_date;
      }
    }
    companyMap.set(name, cur);
  }

  // 각 기업의 강좌 수 = 기업 내 unique (course_name)
  for (const [name, info] of companyMap) {
    const courses = new Set<string>();
    for (const s of allStudents) {
      if (s.company_name === name && s.course_name) courses.add(s.course_name);
    }
    info.courseCount = courses.size;
  }

  const companies = Array.from(companyMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "ko")
  );

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">기업별 관리</h1>
          <p className="text-sm text-slate-500">
            계약된 고객사 목록입니다. 클릭하면 세부 관리 페이지로 이동합니다.
          </p>
        </header>

        <CompanyBoardClient companies={companies} />
      </main>
    </>
  );
}
