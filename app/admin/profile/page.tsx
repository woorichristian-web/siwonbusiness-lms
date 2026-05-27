import { requireRole } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import AdminProfileForm from "@/components/AdminProfileForm";

export const dynamic = "force-dynamic";

export default async function AdminProfilePage() {
  const profile = await requireRole(["admin"]);
  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">마이페이지</h1>
          <p className="text-sm text-slate-500">기본 정보 수정 및 비밀번호 변경.</p>
        </header>
        <AdminProfileForm profile={profile} />
      </main>
    </>
  );
}
