"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** 강사 화면 언어 토글 — 헤더에 표시. 쿠키(teacher_lang) 변경 후 서버 렌더 갱신. */
export default function LanguageToggle({ lang }: { lang: "en" | "ko" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setLang(next: "en" | "ko") {
    if (next === lang) return;
    document.cookie = `teacher_lang=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  const btn = (v: "en" | "ko", label: string) => (
    <button
      type="button"
      onClick={() => setLang(v)}
      disabled={pending}
      className={
        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition " +
        (lang === v
          ? "bg-white text-blue-900"
          : "text-blue-100 hover:bg-white/10 hover:text-white")
      }
    >
      {label}
    </button>
  );

  return (
    <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-white/25 bg-white/10 p-0.5">
      {btn("ko", "한국어")}
      {btn("en", "English")}
    </div>
  );
}
