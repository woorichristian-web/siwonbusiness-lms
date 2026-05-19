import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getStudentProgress } from "@/lib/progress";
import AppHeader from "@/components/AppHeader";
import ProgressReport from "@/components/ProgressReport";

export const dynamic = "force-dynamic";

export default async function TeacherProgressPage({
  params,
}: {
  params: { studentId: string };
}) {
  const profile = await requireRole(["teacher", "admin"]);
  const data = await getStudentProgress(params.studentId);

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4">
          <Link href="/teacher/class-manage"
            className="text-sm text-brand-600 hover:underline">
            ← Back to Class Manage
          </Link>
        </div>
        {data ? (
          <ProgressReport data={data} />
        ) : (
          <div className="card text-center text-slate-500">
            Student not found.
          </div>
        )}
      </main>
    </>
  );
}
