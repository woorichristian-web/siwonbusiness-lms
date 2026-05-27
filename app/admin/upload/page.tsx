import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import AdminUploadTabs from "@/components/AdminUploadTabs";

export const dynamic = "force-dynamic";

export default async function AdminUploadPage() {
  const profile = await requireRole(["admin"]);
  const supabase = createClient();

  // 기업 목록 (다운로드 탭에서 기업별 선택용)
  const { data: rows } = await supabase
    .from("profiles")
    .select("company_name")
    .eq("role", "student");
  const companies = Array.from(
    new Set((rows ?? []).map((r: any) => r.company_name).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "ko"));

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">DB 관리</h1>
          <p className="text-sm text-slate-500">
            교육생 명단·강사 시간표 일괄 업로드와 출석·평가 데이터 통합 Excel 다운로드.
          </p>
        </header>

        <AdminUploadTabs companies={companies} />
      </main>
    </>
  );
}
