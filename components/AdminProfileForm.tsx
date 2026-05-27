"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMyProfile, changeMyPassword } from "@/lib/actions/profile";
import type { Profile } from "@/lib/types";
import BirthDateInput from "@/components/BirthDateInput";
import PhoneInput from "@/components/PhoneInput";

export default function AdminProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [name, setName] = useState(profile.name ?? "");
  const [birth, setBirth] = useState(profile.birth_date ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const r = await updateMyProfile({
        name,
        birth_date: birth || null,
        phone: phone || null,
      });
      if (!r.ok) { setMsg({ type: "err", text: r.error ?? "저장 실패" }); return; }
      setMsg({ type: "ok", text: "기본 정보가 저장되었습니다." });
      router.refresh();
    });
  }

  function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!pw1 || !pw2) return setMsg({ type: "err", text: "비밀번호를 입력하세요." });
    if (pw1 !== pw2) return setMsg({ type: "err", text: "비밀번호 확인이 일치하지 않습니다." });
    if (pw1.length < 8) return setMsg({ type: "err", text: "비밀번호는 8자 이상이어야 합니다." });
    startTransition(async () => {
      const r = await changeMyPassword(pw1);
      if (!r.ok) { setMsg({ type: "err", text: r.error ?? "변경 실패" }); return; }
      setMsg({ type: "ok", text: "비밀번호가 변경되었습니다." });
      setPw1(""); setPw2("");
    });
  }

  return (
    <div className="space-y-6">
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

      {/* 계정 정보 (읽기 전용) */}
      <section className="card">
        <h2 className="mb-3 text-base font-semibold">계정 정보</h2>
        <div className="space-y-1 text-sm">
          <Row k="아이디" v={profile.username} />
          <Row k="역할" v="관리자" />
          <Row k="가입일" v={new Date(profile.created_at).toLocaleDateString("ko-KR")} />
        </div>
      </section>

      {/* 기본 정보 수정 */}
      <form onSubmit={saveProfile} className="card space-y-4">
        <h2 className="text-base font-semibold">기본 정보</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">이름</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">생년월일</label>
            <BirthDateInput value={birth} onChange={setBirth} />
          </div>
        </div>

        <div>
          <label className="label">연락처</label>
          <PhoneInput value={phone} onChange={setPhone} />
        </div>

        <button type="submit" className="btn w-full" disabled={pending}>
          {pending ? "저장 중..." : "기본 정보 저장"}
        </button>
      </form>

      {/* 비밀번호 변경 */}
      <form onSubmit={savePassword} className="card space-y-4">
        <h2 className="text-base font-semibold">🔑 비밀번호 변경</h2>

        <div>
          <label className="label">새 비밀번호 (8자 이상)</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              className="input pr-16"
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
            minLength={8}
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />
        </div>

        <button type="submit" className="btn" disabled={pending || !pw1 || !pw2}>
          {pending ? "변경 중..." : "비밀번호 변경"}
        </button>
      </form>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex border-b border-slate-100 py-1 last:border-b-0">
      <span className="w-24 text-slate-500">{k}</span>
      <span className="flex-1 text-slate-800">{v}</span>
    </div>
  );
}
