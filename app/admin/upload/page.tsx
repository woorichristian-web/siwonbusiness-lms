import { requireRole } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import AdminUploadTabs from "@/components/AdminUploadTabs";

export const dynamic = "force-dynamic";

export default async function AdminUploadPage() {
  const profile = await requireRole(["admin"]);
  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">일괄 업로드</h1>
          <p className="text-sm text-slate-500">
            엑셀(.xlsx) / CSV 파일로 강사 시간표 또는 교육생 명단을 한번에 등록합니다.
          </p>
        </header>

        <AdminUploadTabs />
      </main>
    </>
  );
}
