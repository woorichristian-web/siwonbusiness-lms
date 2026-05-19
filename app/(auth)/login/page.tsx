import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-brand-900">Siwon Business 수강신청</h1>
        <p className="mt-1 text-sm text-slate-500">로그인하여 학습을 시작하세요.</p>
      </header>
      <LoginForm />
    </main>
  );
}
