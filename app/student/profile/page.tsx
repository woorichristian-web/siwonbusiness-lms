import { requireRole } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import MyProfileForm from "@/components/MyProfileForm";

export const dynamic = "force-dynamic";

export default async function StudentProfilePage() {
  const profile = await requireRole(["student", "admin"]);
  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">마이페이지</h1>
          <p className="text-sm text-slate-500">기본 정보를 직접 수정하실 수 있습니다.</p>
        </header>
        <MyProfileForm profile={profile} />
      </main>
    </>
  );
}
