import Link from "next/link";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-brand-900">비밀번호 찾기</h1>
        <p className="mt-1 text-sm text-slate-500">
          가입 시 입력한 정보로 본인 확인 후 새 비밀번호를 설정합니다.
        </p>
      </header>

      <ForgotPasswordForm />

      <p className="mt-4 text-center text-sm text-slate-500">
        <Link href="/login" className="text-brand-600 hover:underline">← 로그인으로 돌아가기</Link>
      </p>
    </main>
  );
}
