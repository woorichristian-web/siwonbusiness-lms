import LoginForm from "@/components/LoginForm";
import BrandLogo from "@/components/BrandLogo";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      {/* 로그인 진입 스플래시 — 로고를 약 1.8초 보여준 뒤 페이드아웃 (로그인 페이지에서만) */}
      <div className="login-splash" aria-hidden="true">
        <BrandLogo size={176} />
      </div>

      <header className="mb-8 text-center">
        <BrandLogo size={104} className="mx-auto mb-4 drop-shadow-md" />
        <h1 className="text-2xl font-bold text-brand-900">Siwon Business LMS</h1>
        <p className="mt-1 text-sm text-slate-500">로그인하여 학습을 시작하세요.</p>
      </header>
      <LoginForm />
    </main>
  );
}
