import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <header className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/192?v=6"
          alt="Siwon Business 로고"
          width={104}
          height={104}
          className="mx-auto mb-4 rounded-3xl shadow-md"
        />
        <h1 className="text-2xl font-bold text-brand-900">Siwon Business LMS</h1>
        <p className="mt-1 text-sm text-slate-500">로그인하여 학습을 시작하세요.</p>
      </header>
      <LoginForm />
    </main>
  );
}
