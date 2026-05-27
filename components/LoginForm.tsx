"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/constants";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const email = usernameToEmail(username);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="label">아이디</label>
        <input
          className="input"
          required
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <div>
        <label className="label">비밀번호</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            className="input pr-16"
            required
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            tabIndex={-1}
          >
            {showPassword ? "숨기기" : "보기"}
          </button>
        </div>
        {password.length > 0 && (
          <p className="mt-1 text-xs text-slate-400">
            {password.length}자 입력됨 · 마지막 글자 미리보기: <code className="rounded bg-slate-100 px-1">{password.slice(-3)}</code>
          </p>
        )}
      </div>

      <button type="submit" disabled={loading} className="btn w-full">
        {loading ? "로그인 중..." : "로그인"}
      </button>

      <div className="flex items-center justify-between text-sm">
        <a href="/forgot-password" className="text-slate-500 hover:text-brand-600 hover:underline">
          🔑 비밀번호 찾기
        </a>
        <a href="/signup" className="font-medium text-brand-600 hover:underline">
          회원가입
        </a>
      </div>
    </form>
  );
}
