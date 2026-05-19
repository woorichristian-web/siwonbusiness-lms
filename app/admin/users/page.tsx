import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import AdminUsersTabs from "@/components/AdminUsersTabs";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const profile = await requireRole(["admin"]);
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const allProfiles = (rows ?? []) as Profile[];

  // 강사 목록 (편집 모달의 배정 강사 드롭다운용)
  const teachers = allProfiles
    .filter((p) => p.role === "teacher")
    .map((t) => ({ id: t.id, name: t.name }));

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">회원 관리</h1>
            <p className="text-sm text-slate-500">
              교육생·강사·관리자 탭으로 구분된 회원 목록입니다. 총 {allProfiles.length}명.
            </p>
          </div>
          <Link className="btn" href="/admin/users/add">+ 회원 직접 추가</Link>
        </header>

        <AdminUsersTabs users={allProfiles} teachers={teachers} />
      </main>
    </>
  );
}
