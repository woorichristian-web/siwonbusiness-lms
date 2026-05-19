import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import AdminUserAddForm from "@/components/AdminUserAddForm";

export const dynamic = "force-dynamic";

export default async function AdminUserAddPage() {
  const profile = await requireRole(["admin"]);
  const supabase = createClient();

  // 배정 강사 선택용 강사 목록
  const { data: teachers } = await supabase
    .from("profiles")
    .select("id, name, username")
    .eq("role", "teacher")
    .order("name", { ascending: true });

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">회원 직접 추가</h1>
          <p className="text-sm text-slate-500">관리자가 교육생·강사·관리자 계정을 직접 생성합니다.</p>
        </header>
        <AdminUserAddForm teachers={(teachers ?? []) as any} />
      </main>
    </>
  );
}
