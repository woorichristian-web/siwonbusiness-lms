import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStudentProgress, type ProgressData } from "@/lib/progress";
import AppHeader from "@/components/AppHeader";
import CompanyBatchDownloadClient from "@/components/CompanyBatchDownloadClient";

export const dynamic = "force-dynamic";

export default async function AdminCompanyBatchProgressPage({
  searchParams,
}: {
  searchParams: { company?: string };
}) {
  const profile = await requireRole(["admin"]);
  const supabase = createClient();

  // 회사 목록 (드롭다운)
  const { data: allStudents } = await supabase
    .from("profiles")
    .select("id, name, company_name")
    .eq("role", "student");

  const companies = Array.from(
    new Set((allStudents ?? []).filter((s) => s.company_name).map((s) => s.company_name!))
  ).sort();

  const selected = searchParams.company || companies[0] || "";

  // 선택된 회사의 학생들 Progress 데이터
  let reports: ProgressData[] = [];
  if (selected) {
    const studentIds = (allStudents ?? [])
      .filter((s) => s.company_name === selected)
      .map((s) => s.id);
    reports = (
      await Promise.all(studentIds.map((id) => getStudentProgress(id)))
    ).filter((r): r is ProgressData => r !== null);
  }

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4">
          <Link href="/admin/companies" className="text-sm text-brand-600 hover:underline">
            ← Back to 기업별 관리
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">기업별 Progress Report 일괄 다운로드</h1>
          <p className="text-sm text-slate-500">
            기업을 선택하면 소속 교육생들의 리포트를 한 번에 PNG ZIP으로 받을 수 있습니다.
          </p>
        </header>

        <CompanyBatchDownloadClient
          companies={companies}
          selectedCompany={selected}
          reports={reports}
        />
      </main>
    </>
  );
}
