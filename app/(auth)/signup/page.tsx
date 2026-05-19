import SignupForm from "@/components/SignupForm";

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-brand-900">회원가입</h1>
        <p className="mt-1 text-sm text-slate-500">
          기업 영어 학습 신청을 위한 정보를 입력해주세요.
        </p>
      </header>
      <SignupForm />
    </main>
  );
}
