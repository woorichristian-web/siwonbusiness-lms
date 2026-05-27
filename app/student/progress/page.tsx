import { requireRole } from "@/lib/auth";
import { getStudentProgress } from "@/lib/progress";
import AppHeader from "@/components/AppHeader";
import ProgressReport from "@/components/ProgressReport";

export const dynamic = "force-dynamic";

export default async function StudentProgressPage() {
  const profile = await requireRole(["student", "admin"]);
  const data = await getStudentProgress(profile.id);

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">학습 진행 리포트</h1>
          <p className="text-sm text-slate-500">
            내 출석률과 영역별 평가 점수 추이를 확인할 수 있습니다.
          </p>
        </header>
        {data ? (
          <ProgressReport data={data} hideDownload />
        ) : (
          <div className="card text-center text-slate-500">
            아직 데이터가 없습니다.
          </div>
        )}
      </main>
    </>
  );
}
