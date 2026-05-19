import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-brand-900">Siwon Business 수강신청</h1>
        <p className="mt-2 text-slate-600">기업 영어 교육 학습 관리 시스템</p>

        <div className="mt-8 flex flex-col gap-3">
          <Link href="/login" className="btn w-full">로그인</Link>
          <Link href="/signup" className="btn-ghost w-full">회원가입</Link>
        </div>

        <p className="mt-8 text-xs text-slate-400">
          관리자는 회원가입 후 별도 권한 부여가 필요합니다.
        </p>
      </div>
    </main>
  );
}
