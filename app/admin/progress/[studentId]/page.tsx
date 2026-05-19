import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getStudentProgress } from "@/lib/progress";
import AppHeader from "@/components/AppHeader";
import ProgressReport from "@/components/ProgressReport";

export const dynamic = "force-dynamic";

export default async function AdminProgressPage({
  params,
}: {
  params: { studentId: string };
}) {
  const profile = await requireRole(["admin"]);
  const data = await getStudentProgress(params.studentId);

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4">
          <Link href="/admin/users" className="text-sm text-brand-600 hover:underline">
            ← Back to 회원 관리
          </Link>
        </div>
        {data ? (
          <ProgressReport data={data} />
        ) : (
          <div className="card text-center text-slate-500">교육생을 찾을 수 없습니다.</div>
        )}
      </main>
    </>
  );
}
