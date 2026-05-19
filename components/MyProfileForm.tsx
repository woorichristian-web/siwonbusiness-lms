"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMyProfile, changeMyPassword } from "@/lib/actions/profile";
import {
  REGIONS,
  INDUSTRIES,
  JOB_ROLES,
  LEARNING_PURPOSES,
  CLASS_FORMATS,
  CLASS_TYPES,
  TIME_PREFERENCES,
} from "@/lib/constants";
import type { Profile } from "@/lib/types";
import BirthDateInput from "@/components/BirthDateInput";
import PhoneInput from "@/components/PhoneInput";

export default function MyProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 기존 preferred_format 배열에서 format/type 분리
  const initFormats = (profile.preferred_format ?? []).filter((v) => v === "online" || v === "offline");
  const initTypes = (profile.preferred_format ?? []).filter((v) => v === "1on1" || v === "small_group");

  const [name, setName] = useState(profile.name ?? "");
  const [birth, setBirth] = useState(profile.birth_date ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [region, setRegion] = useState(profile.residence_area ?? "");
  const [company, setCompany] = useState(profile.company_name ?? "");
  const [industry, setIndustry] = useState(profile.industry ?? "");
  const [jobRole, setJobRole] = useState(profile.job_role ?? "");
  const [purpose, setPurpose] = useState(profile.learning_purpose ?? "");
  const [formats, setFormats] = useState<string[]>(initFormats);
  const [types, setTypes] = useState<string[]>(initTypes);
  const [times, setTimes] = useState<string[]>(profile.preferred_time ?? []);

  // 비밀번호 변경
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  function toggle(setter: (a: string[]) => void, arr: string[], v: string) {
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const r = await updateMyProfile({
        name,
        birth_date: birth || null,
        phone: phone || null,
        residence_area: region || null,
        company_name: company,
        industry: industry || null,
        job_role: jobRole || null,
        learning_purpose: purpose || null,
        preferred_format: [...formats, ...types],
        preferred_time: times,
      });
      if (!r.ok) { setMsg({ type: "err", text: r.error ?? "저장 실패" }); return; }
      setMsg({ type: "ok", text: "기본정보가 저장되었습니다." });
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

      {/* 읽기 전용 정보 */}
      <section className="card">
        <h2 className="mb-3 text-base font-semibold">계정 정보</h2>
        <div className="space-y-1 text-sm">
          <ReadRow k="아이디" v={profile.username} />
          <ReadRow k="역할" v={profile.role === "admin" ? "관리자" : profile.role === "teacher" ? "강사" : "교육생"} />
          <ReadRow k="가입일" v={new Date(profile.created_at).toLocaleDateString("ko-KR")} />
        </div>
      </section>

      {/* 기본정보 수정 */}
      <form onSubmit={saveProfile} className="space-y-6">
        <section className="card space-y-4">
          <h2 className="text-base font-semibold">기본 정보</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">이름 *</label>
              <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">생년월일</label>
              <BirthDateInput value={birth} onChange={setBirth} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">연락처</label>
              <PhoneInput value={phone} onChange={setPhone} />
            </div>
            <div>
              <label className="label">주거 지역</label>
              <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">선택</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="card space-y-4">
          <h2 className="text-base font-semibold">직장 정보</h2>

          <div>
            <label className="label">회사명</label>
            <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">산업 분야</label>
              <select className="input" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                <option value="">선택</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="label">직무 분야</label>
              <select className="input" value={jobRole} onChange={(e) => setJobRole(e.target.value)}>
                <option value="">선택</option>
                {JOB_ROLES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="card space-y-4">
          <h2 className="text-base font-semibold">학습 선호</h2>

          <div>
            <label className="label">영어 학습 목적</label>
            <select className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option value="">선택</option>
              {LEARNING_PURPOSES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          <ChipGroup
            label="선호 수업 방식 (온라인/오프라인)"
            options={CLASS_FORMATS as unknown as { value: string; label: string }[]}
            selected={formats}
            onToggle={(v) => toggle(setFormats, formats, v)}
          />
          <ChipGroup
            label="선호 수업 형태 (1:1 / 소그룹)"
            options={CLASS_TYPES as unknown as { value: string; label: string }[]}
            selected={types}
            onToggle={(v) => toggle(setTypes, types, v)}
          />
          <ChipGroup
            label="선호 시간대"
            options={TIME_PREFERENCES as unknown as { value: string; label: string }[]}
            selected={times}
            onToggle={(v) => toggle(setTimes, times, v)}
          />
        </section>

        <button type="submit" className="btn w-full" disabled={pending}>
          {pending ? "저장 중..." : "기본 정보 저장"}
        </button>
      </form>

      {/* 비밀번호 변경 */}
      <form onSubmit={savePassword} className="card space-y-4">
        <h2 className="text-base font-semibold">비밀번호 변경</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">새 비밀번호</label>
            <input type="password" className="input" minLength={8}
              value={pw1} onChange={(e) => setPw1(e.target.value)} />
          </div>
          <div>
            <label className="label">새 비밀번호 확인</label>
            <input type="password" className="input" minLength={8}
              value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="btn" disabled={pending || !pw1 || !pw2}>
          {pending ? "변경 중..." : "비밀번호 변경"}
        </button>
      </form>
    </div>
  );
}

function ReadRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex border-b border-slate-100 py-1 last:border-b-0">
      <span className="w-24 text-slate-500">{k}</span>
      <span className="flex-1 text-slate-800">{v}</span>
    </div>
  );
}

function ChipGroup({
  label, options, selected, onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => onToggle(opt.value)}
              className={
                "rounded-full border px-4 py-1.5 text-sm transition " +
                (active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-brand-500")
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
