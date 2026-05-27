"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetPasswordBySelfVerify } from "@/lib/actions/password-reset";
import BirthDateInput from "@/components/BirthDateInput";

export default function ForgotPasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!username || !name || !birth) {
      setMsg({ type: "err", text: "모든 항목을 입력해주세요." });
      return;
    }
    if (pw1.length < 8) {
      setMsg({ type: "err", text: "새 비밀번호는 8자 이상이어야 합니다." });
      return;
    }
    if (pw1 !== pw2) {
      setMsg({ type: "err", text: "비밀번호 확인이 일치하지 않습니다." });
      return;
    }

    startTransition(async () => {
      const r = await resetPasswordBySelfVerify({
        username,
        name,
        birth_date: birth,
        new_password: pw1,
      });
      if (!r.ok) { setMsg({ type: "err", text: r.error ?? "변경 실패" }); return; }
      setMsg({ type: "ok", text: "비밀번호가 변경되었습니다. 로그인 페이지로 이동합니다..." });
      setTimeout(() => router.push("/login"), 1500);
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      {msg && (
        <div className={
          "rounded-md border p-3 text-sm " +
          (msg.type === "ok"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700")
        }>
          {msg.text}
        </div>
      )}

      <div>
        <label className="label">아이디</label>
        <input
          className="input"
          required
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <div>
        <label className="label">이름 (가입 시 입력한)</label>
        <input
          className="input"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="label">생년월일 (가입 시 입력한)</label>
        <BirthDateInput value={birth} onChange={setBirth} required />
      </div>

      <div>
        <label className="label">새 비밀번호 (8자 이상)</label>
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            className="input pr-16"
            required
            minLength={8}
            autoComplete="new-password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            tabIndex={-1}
          >
            {showPw ? "숨기기" : "보기"}
          </button>
        </div>
      </div>

      <div>
        <label className="label">새 비밀번호 확인</label>
        <input
          type={showPw ? "text" : "password"}
          className="input"
          required
          minLength={8}
          autoComplete="new-password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
        />
      </div>

      <button type="submit" className="btn w-full" disabled={pending}>
        {pending ? "변경 중..." : "비밀번호 재설정"}
      </button>

      <p className="text-xs text-slate-400">
        본인 확인에 실패하면 관리자에게 문의해주세요.
      </p>
    </form>
  );
}
