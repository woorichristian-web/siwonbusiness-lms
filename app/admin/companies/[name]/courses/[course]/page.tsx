import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getCourseReport } from "@/lib/course-report";
import AppHeader from "@/components/AppHeader";
import CourseReport from "@/components/CourseReport";

export const dynamic = "force-dynamic";

export default async function CourseReportPage({
  params,
}: {
  params: { name: string; course: string };
}) {
  const profile = await requireRole(["admin"]);
  const companyName = decodeURIComponent(params.name);
  const courseName = decodeURIComponent(params.course);
  const data = await getCourseReport(companyName, courseName);

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4">
          <Link href={`/admin/companies/${encodeURIComponent(companyName)}`}
            className="text-sm text-brand-600 hover:underline">
            ← {companyName} 페이지로
          </Link>
        </div>

        <header className="mb-6">
          <p className="text-sm text-slate-500">🏢 {companyName}</p>
          <h1 className="text-2xl font-bold text-slate-800">📚 {courseName}</h1>
          <p className="mt-1 text-sm text-slate-500">
            계약 강좌의 종합 리포트입니다.
            {data.startDate && data.endDate && ` 기간 ${data.startDate} ~ ${data.endDate} · `}
            {data.totalSessions != null && `총 ${data.totalSessions}차시`}
          </p>
        </header>

        <CourseReport data={data} />
      </main>
    </>
  );
}
