"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publicSignup } from "@/lib/actions/signup";
import {
  REGIONS,
  INDUSTRIES,
  JOB_ROLES,
  LEARNING_PURPOSES,
  CLASS_FORMATS,
  CLASS_TYPES,
  TIME_PREFERENCES,
} from "@/lib/constants";
import BirthDateInput from "@/components/BirthDateInput";
import PhoneInput from "@/components/PhoneInput";

type FormState = {
  name: string;
  birth_date: string;
  username: string;
  password: string;
  password_confirm: string;
  phone: string;
  residence_area: string;
  company_name: string;
  industry: string;
  job_role: string;
  learning_purpose: string;
  formats: string[];   // online/offline
  types: string[];     // 1on1/small_group
  times: string[];     // early_morning/lunch/evening
};

const empty: FormState = {
  name: "",
  birth_date: "",
  username: "",
  password: "",
  password_confirm: "",
  phone: "",
  residence_area: "",
  company_name: "",
  industry: "",
  job_role: "",
  learning_purpose: "",
  formats: [],
  types: [],
  times: [],
};

export default function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggle(k: "formats" | "types" | "times", value: string) {
    setForm((f) => {
      const has = f[k].includes(value);
      return { ...f, [k]: has ? f[k].filter((x) => x !== value) : [...f[k], value] };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // 검증
    if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(form.username)) {
      setError("아이디는 영문/숫자/._- 조합 3~20자로 입력해주세요.");
      return;
    }
    if (form.password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (form.password !== form.password_confirm) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    if (!form.name || !form.birth_date || !form.company_name) {
      setError("이름·생년월일·회사명은 필수입니다.");
      return;
    }

    setLoading(true);
    const result = await publicSignup({
      name: form.name.trim(),
      birth_date: form.birth_date,
      username: form.username.trim().toLowerCase(),
      password: form.password,
      company_name: form.company_name.trim(),
      phone: form.phone.trim() || undefined,
      residence_area: form.residence_area || undefined,
      industry: form.industry || undefined,
      job_role: form.job_role || undefined,
      learning_purpose: form.learning_purpose || undefined,
      preferred_format: [...form.formats, ...form.types],
      preferred_time: form.times,
    });

    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "회원가입 실패");
      return;
    }

    // 자동 로그인 성공 → dashboard, 실패 시 로그인 페이지로
    router.push(result.autoLogin ? "/dashboard" : "/login");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 기본 정보 */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">기본 정보</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">이름 *</label>
            <input className="input" required value={form.name}
              onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className="label">생년월일 *</label>
            <BirthDateInput value={form.birth_date} onChange={(v) => set("birth_date", v)} required />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">아이디 * (영문/숫자, 3~20자)</label>
            <input className="input" required minLength={3} maxLength={20}
              value={form.username}
              onChange={(e) => set("username", e.target.value)} />
          </div>
          <div>
            <label className="label">비밀번호 * (8자 이상)</label>
            <input type="password" className="input" required minLength={8}
              value={form.password}
              onChange={(e) => set("password", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">비밀번호 확인 *</label>
          <input type="password" className="input" required minLength={8}
            value={form.password_confirm}
            onChange={(e) => set("password_confirm", e.target.value)} />
        </div>

        <div>
          <label className="label">연락처 (휴대폰)</label>
          <PhoneInput value={form.phone} onChange={(v) => set("phone", v)} />
        </div>
      </section>

      {/* 교육생 추가 정보 */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">교육생 추가 정보</h2>

        <div>
          <label className="label">주거 지역</label>
          <select className="input" value={form.residence_area}
            onChange={(e) => set("residence_area", e.target.value)}>
            <option value="">선택하세요</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <label className="label">회사명 *</label>
          <input className="input" required value={form.company_name}
            onChange={(e) => set("company_name", e.target.value)} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">산업 분야</label>
            <select className="input" value={form.industry}
              onChange={(e) => set("industry", e.target.value)}>
              <option value="">선택하세요</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="label">직무 분야</label>
            <select className="input" value={form.job_role}
              onChange={(e) => set("job_role", e.target.value)}>
              <option value="">선택하세요</option>
              {JOB_ROLES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* 학습 선호 */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">학습 선호</h2>

        <div>
          <label className="label">영어 학습 목적</label>
          <select className="input" value={form.learning_purpose}
            onChange={(e) => set("learning_purpose", e.target.value)}>
            <option value="">선택하세요</option>
            {LEARNING_PURPOSES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <CheckGroup
          label="선호 수업 방식 (온라인/오프라인)"
          options={CLASS_FORMATS as unknown as { value: string; label: string }[]}
          selected={form.formats}
          onToggle={(v) => toggle("formats", v)}
        />

        <CheckGroup
          label="선호 수업 방식 (1:1 / 소그룹)"
          options={CLASS_TYPES as unknown as { value: string; label: string }[]}
          selected={form.types}
          onToggle={(v) => toggle("types", v)}
        />

        <CheckGroup
          label="선호 시간대"
          options={TIME_PREFERENCES as unknown as { value: string; label: string }[]}
          selected={form.times}
          onToggle={(v) => toggle("times", v)}
        />
      </section>

      <button type="submit" disabled={loading} className="btn w-full">
        {loading ? "가입 중..." : "회원가입"}
      </button>

      <p className="text-center text-sm text-slate-500">
        이미 계정이 있으신가요?{" "}
        <a href="/login" className="font-medium text-brand-600 hover:underline">로그인</a>
      </p>
    </form>
  );
}

function CheckGroup({
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
