"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  updateMyProfile,
  updateMyTeacher,
  changeMyPassword,
  agreePayroll,
  cancelPayrollAgreement,
} from "@/lib/actions/profile";

const CENTER_EMAIL = "b2b@siwonschool.com";
import type { Profile, Teacher } from "@/lib/types";
import BirthDateInput from "@/components/BirthDateInput";
import PhoneInput from "@/components/PhoneInput";

interface Stats {
  totalCompleted: number;
  totalHours: number;
  thisMonthCompleted: number;
  thisMonthHours: number;
}

interface MonthlyRow {
  yearMonth: string;
  classCount: number;
  hours: number;
  /** 그 달의 첫 수업 ~ 마지막 수업 날짜 */
  period: string;
}

type Lang = "en" | "ko";

export default function TeacherProfileTabs({
  profile,
  teacher,
  tab,
  stats,
  monthly,
  agreements,
  lang = "en",
}: {
  profile: Profile;
  teacher: Teacher | null;
  tab: "info" | "payroll";
  stats: Stats;
  monthly: MonthlyRow[];
  agreements: Record<string, string>;
  lang?: Lang;
}) {
  const ko = lang === "ko";
  return (
    <div>
      {/* 탭 */}
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        <TabLink href="/teacher/profile" active={tab === "info"}>
          {ko ? "기본 정보" : "Info"}
        </TabLink>
        <TabLink href="/teacher/profile?tab=payroll" active={tab === "payroll"}>
          {ko ? "정산" : "Payroll"}
        </TabLink>
      </div>

      {tab === "info" ? (
        <InfoSection profile={profile} teacher={teacher} lang={lang} />
      ) : (
        <PayrollSection
          teacher={teacher}
          stats={stats}
          monthly={monthly}
          agreements={agreements}
          lang={lang}
        />
      )}
    </div>
  );
}

function TabLink({
  href, active, children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition " +
        (active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-700")
      }
    >
      {children}
    </Link>
  );
}

// =====================================================================
// INFO TAB
// =====================================================================
function InfoSection({
  profile, teacher, lang = "en",
}: {
  profile: Profile;
  teacher: Teacher | null;
  lang?: Lang;
}) {
  const ko = lang === "ko";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [name, setName] = useState(profile.name ?? "");
  const [birth, setBirth] = useState(profile.birth_date ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [bio, setBio] = useState(teacher?.bio ?? "");
  const [specialty, setSpecialty] = useState(teacher?.specialty ?? "");
  const [languages, setLanguages] = useState((teacher as any)?.languages ?? "");
  const [zoomUrl, setZoomUrl] = useState(teacher?.zoom_url ?? "");
  const [teamsUrl, setTeamsUrl] = useState(teacher?.teams_url ?? "");

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const r1 = await updateMyProfile({
        name,
        birth_date: birth || null,
        phone: phone || null,
      });
      if (!r1.ok) { setMsg({ type: "err", text: r1.error ?? "Failed to update profile" }); return; }

      const r2 = await updateMyTeacher({
        bio: bio.trim() || null,
        specialty: specialty.trim() || null,
        languages: languages.trim() || null,
        zoom_url: zoomUrl.trim() || null,
        teams_url: teamsUrl.trim() || null,
      });
      if (!r2.ok) { setMsg({ type: "err", text: r2.error ?? "Failed to update profile" }); return; }

      setMsg({ type: "ok", text: ko ? "정보가 저장되었습니다." : "Your information has been saved." });
      router.refresh();
    });
  }

  function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!pw1 || !pw2) return setMsg({ type: "err", text: ko ? "새 비밀번호를 입력하세요." : "Please enter a new password." });
    if (pw1 !== pw2) return setMsg({ type: "err", text: ko ? "비밀번호가 일치하지 않습니다." : "Passwords do not match." });
    if (pw1.length < 8) return setMsg({ type: "err", text: ko ? "비밀번호는 8자 이상이어야 합니다." : "Password must be at least 8 characters." });
    startTransition(async () => {
      const r = await changeMyPassword(pw1);
      if (!r.ok) { setMsg({ type: "err", text: r.error ?? "Failed to change password" }); return; }
      setMsg({ type: "ok", text: ko ? "비밀번호가 변경되었습니다." : "Password changed successfully." });
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
        }>{msg.text}</div>
      )}

      <section className="card">
        <h2 className="mb-3 text-base font-semibold">{ko ? "계정 정보" : "Account"}</h2>
        <div className="space-y-1 text-sm">
          <ReadRow k={ko ? "아이디" : "Username"} v={profile.username} />
          <ReadRow k={ko ? "역할" : "Role"} v={ko ? "강사" : "Teacher"} />
          <ReadRow k={ko ? "가입일" : "Joined"} v={new Date(profile.created_at).toLocaleDateString(ko ? "ko-KR" : "en-US")} />
        </div>
      </section>

      <form onSubmit={saveProfile} className="space-y-6">
        <section className="card space-y-4">
          <h2 className="text-base font-semibold">{ko ? "기본 정보" : "Basic Info"}</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{ko ? "이름" : "Name"}</label>
              <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">{ko ? "생년월일" : "Date of birth"}</label>
              <BirthDateInput value={birth} onChange={setBirth} />
            </div>
          </div>

          <div>
            <label className="label">{ko ? "연락처" : "Phone"}</label>
            <PhoneInput value={phone} onChange={setPhone} />
          </div>
        </section>

        <section className="card space-y-4">
          <h2 className="text-base font-semibold">{ko ? "프로필" : "Profile"}</h2>

          <div>
            <label className="label">{ko ? "전문 분야" : "Specialty"}</label>
            <input className="input" placeholder="e.g. Business English, IELTS prep"
              value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
          </div>

          <div>
            <label className="label">{ko ? "티칭 언어" : "Languages you teach in"}</label>
            <input className="input" placeholder="e.g. English, Korean"
              value={languages} onChange={(e) => setLanguages(e.target.value)} />
            <p className="mt-1 text-xs text-slate-400">{ko ? "쉼표로 구분. 센터가 과정 배정 시 사용합니다." : "Comma-separated. Used by the center when assigning courses."}</p>
          </div>

          <div>
            <label className="label">{ko ? "소개 (센터에게 표시)" : "Bio (shown to admins)"}</label>
            <textarea className="input min-h-[100px]"
              placeholder={"One item per line, e.g.\nB.A. ... (University)\nCertifications: ...\nExperience: ..."}
              value={bio} onChange={(e) => setBio(e.target.value)} />
            <p className="mt-1 text-xs text-slate-400">{ko ? "한 줄에 한 정보씩 적어주세요 (학력, 자격, 경력 등)." : "Write one piece of information per line (degree, certifications, experience, ...)."}</p>
          </div>
        </section>

        <section className="card space-y-4">
          <h2 className="text-base font-semibold">{ko ? "온라인 회의실" : "Online Meeting Rooms"}</h2>
          <p className="text-xs text-slate-500">
            {ko ? "기본 회의실 링크입니다. 수업 카드에 표시되어 원클릭으로 수업을 시작할 수 있습니다." : "Your default meeting room links. Shown on class detail cards so you can launch the session in one click."}
          </p>

          <div>
            <label className="label">Zoom URL</label>
            <input
              type="url"
              className="input"
              placeholder="https://zoom.us/j/1234567890?pwd=..."
              value={zoomUrl}
              onChange={(e) => setZoomUrl(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">
              {ko ? "개인 회의실 링크 또는 반복 회의 URL을 사용하세요." : "Use your Personal Meeting Room link or a recurring meeting URL."}
            </p>
          </div>

          <div>
            <label className="label">Microsoft Teams URL</label>
            <input
              type="url"
              className="input"
              placeholder="https://teams.microsoft.com/l/meetup-join/..."
              value={teamsUrl}
              onChange={(e) => setTeamsUrl(e.target.value)}
            />
          </div>
        </section>

        <button type="submit" className="btn w-full" disabled={pending}>
          {pending ? (ko ? "저장 중..." : "Saving...") : (ko ? "프로필 저장" : "Save profile")}
        </button>
      </form>

      <form onSubmit={savePassword} className="card space-y-4">
        <h2 className="text-base font-semibold">{ko ? "비밀번호 변경" : "Change password"}</h2>

        <div>
          <label className="label">{ko ? "새 비밀번호 (8자 이상)" : "New password (8+ characters)"}</label>
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
              {showPw ? (ko ? "숨기기" : "Hide") : (ko ? "보기" : "Show")}
            </button>
          </div>
        </div>

        <div>
          <label className="label">{ko ? "새 비밀번호 확인" : "Confirm new password"}</label>
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
          {pending ? (ko ? "변경 중..." : "Changing...") : (ko ? "비밀번호 변경" : "Change password")}
        </button>
      </form>
    </div>
  );
}

// =====================================================================
// PAYROLL TAB
// =====================================================================
function PayrollSection({
  teacher, stats, monthly, agreements, lang = "en",
}: {
  teacher: Teacher | null;
  stats: Stats;
  monthly: MonthlyRow[];
  agreements: Record<string, string>;
  lang?: Lang;
}) {
  const ko = lang === "ko";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busyPeriod, setBusyPeriod] = useState<string | null>(null);
  // Agree 가능 기간: 매월 29일 ~ 다음달 7일
  const today = new Date().getDate();
  const agreeWindow = today >= 29 || today <= 7;
  const [contactPeriod, setContactPeriod] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function onAgree(period: string) {
    setBusyPeriod(period);
    startTransition(async () => {
      const r = await agreePayroll(period);
      setBusyPeriod(null);
      if (!r.ok) { setMsg({ type: "err", text: r.error }); return; }
      router.refresh();
    });
  }
  function onCancelAgree(period: string) {
    setBusyPeriod(period);
    startTransition(async () => {
      const r = await cancelPayrollAgreement(period);
      setBusyPeriod(null);
      if (!r.ok) { setMsg({ type: "err", text: r.error }); return; }
      router.refresh();
    });
  }
  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(CENTER_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setMsg({ type: "err", text: (ko ? "복사에 실패했습니다. 직접 복사해 주세요: " : "Copy failed. Please copy manually: ") + CENTER_EMAIL });
    }
  }

  const [hourlyRate, setHourlyRate] = useState(
    teacher?.hourly_rate != null ? String(teacher.hourly_rate) : ""
  );
  const [bankName, setBankName] = useState(teacher?.bank_name ?? "");
  const [bankAccount, setBankAccount] = useState(teacher?.bank_account ?? "");
  const [accountHolder, setAccountHolder] = useState(teacher?.account_holder ?? "");

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const r = await updateMyTeacher({
        hourly_rate: hourlyRate.trim() === "" ? null : Number(hourlyRate),
        bank_name: bankName.trim() || null,
        bank_account: bankAccount.trim() || null,
        account_holder: accountHolder.trim() || null,
      });
      if (!r.ok) { setMsg({ type: "err", text: r.error ?? "Failed to save" }); return; }
      setMsg({ type: "ok", text: ko ? "정산 정보가 저장되었습니다." : "Payroll info saved." });
      router.refresh();
    });
  }

  const rate = Number(hourlyRate) || 0;
  const estThisMonth = Math.round(rate * stats.thisMonthHours);
  const estTotal = Math.round(rate * stats.totalHours);

  return (
    <div className="space-y-6">
      {msg && (
        <div className={
          "rounded-md border p-3 text-sm " +
          (msg.type === "ok"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700")
        }>{msg.text}</div>
      )}

      {/* Payment summary */}
      <section className="card">
        <h2 className="mb-3 text-base font-semibold">{ko ? "정산 요약" : "Payment Summary"}</h2>
        <p className="mb-3 text-xs text-slate-500">
          {ko ? "출석 체크 기준입니다 (출석·지각 = 진행 완료로 집계)." : `Based on attendance ("Present" and "Late" count as completed).`}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={ko ? "총 수업" : "Total classes"} value={String(stats.totalCompleted)} />
          <Stat label={ko ? "총 시수" : "Total hours"} value={stats.totalHours.toFixed(1)} />
          <Stat
            label={ko ? "이번 달" : "This month"}
            value={`${stats.thisMonthCompleted} (${stats.thisMonthHours.toFixed(1)}h)`}
          />
          <Stat
            label={ko ? "이번 달 예상" : "Est. this month"}
            value={rate > 0 ? `${estThisMonth.toLocaleString()} KRW` : (ko ? "시급 입력 필요" : "Set rate")}
            highlight={rate > 0}
          />
        </div>
        {rate > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            {ko ? "누적 예상 수입: " : "Estimated total earnings to date: "}<b className="text-slate-700">{estTotal.toLocaleString()} KRW</b>
            {" "}({stats.totalHours.toFixed(1)} h × {rate.toLocaleString()} KRW/h)
          </p>
        )}
      </section>

      {/* Monthly settlement statement */}
      <section className="card">
        <h2 className="mb-1 text-base font-semibold">{ko ? "월별 정산" : "Monthly Settlement"}</h2>
        <p className="mb-3 text-xs text-slate-500">
          {ko ? <>월별 정산 내역입니다. 확인 후 <b>동의</b>를 눌러 확정하세요. 이상이 있으면 <b>문의</b>로 센터에 연락하세요.</> : <>Your monthly settlement statement. Review each month and press <b>Agree</b> to confirm.
          If something looks wrong, use <b>Contact</b> to reach the center.</>}
        </p>
        {monthly.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            {ko ? "아직 진행(출석 체크)된 수업이 없습니다." : "No completed (attendance-checked) classes yet."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">{ko ? "월" : "Month"}</th>
                  <th className="px-3 py-2">{ko ? "기간" : "Period"}</th>
                  <th className="px-3 py-2 text-right">{ko ? "시수(h)" : "Hours (h)"}</th>
                  <th className="px-3 py-2 text-right">{ko ? "단가(KRW)" : "Rate (KRW)"}</th>
                  <th className="px-3 py-2 text-right">{ko ? "금액(KRW)" : "Amount (KRW)"}</th>
                  <th className="px-3 py-2 text-center">{ko ? "동의" : "Confirm"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthly.map((m) => {
                  const pay = Math.round(rate * m.hours);
                  const agreedAt = agreements[m.yearMonth];
                  const busy = busyPeriod === m.yearMonth;
                  return (
                    <tr key={m.yearMonth}>
                      <td className="px-3 py-2 font-medium text-slate-800">{m.yearMonth}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500">{m.period}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{m.hours.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        {rate > 0 ? rate.toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">
                        {rate > 0 ? pay.toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {agreedAt ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              ✓ {ko ? "동의함" : "Agreed"}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(agreedAt).toLocaleDateString(ko ? "ko-KR" : "en-US")}
                            </span>
                            <button
                              type="button"
                              onClick={() => onCancelAgree(m.yearMonth)}
                              disabled={busy || !agreeWindow}
                              className="text-[10px] text-slate-400 underline hover:text-slate-600"
                            >
                              {ko ? "동의 취소" : "Cancel"}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onAgree(m.yearMonth)}
                              disabled={busy || !agreeWindow}
                              title={agreeWindow ? undefined : (ko ? "동의는 매월 29일~다음달 7일에만 가능합니다." : "Agree is available from the 29th to the 7th.")}
                              className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {busy ? "..." : (ko ? "동의" : "Agree")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setContactPeriod(m.yearMonth)}
                              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                            >
                              {ko ? "문의" : "Contact"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!agreeWindow && (
          <p className="mt-2 text-xs text-slate-500">
            {ko ? <>⏳ <b>동의</b>는 매월 <b>29일</b>부터 다음달 <b>7일</b>까지만 가능합니다. 그 외 기간에는 버튼이 비활성화됩니다.</> : <>⏳ <b>Agree</b> is open from the <b>29th</b> of each month to the <b>7th</b> of the next month.
            Buttons are disabled outside this window.</>}
          </p>
        )}
        {rate <= 0 && (
          <p className="mt-2 text-xs text-amber-600">
            {ko ? <>※ 금액 계산을 위해 아래 <b>정산 정보</b>에 시급을 입력하세요.</> : <>※ Enter your hourly rate in <b>Payroll Info</b> below to calculate amounts.</>}
          </p>
        )}
      </section>

      {/* Contact popover */}
      {contactPeriod && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setContactPeriod(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-800">{ko ? "정산 문의 — 센터 연락처" : "Settlement Inquiry — Contact"}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {ko ? <><b>{contactPeriod}</b> 정산에 문의가 있으시면 아래 이메일로 센터에 연락해 주세요.</> : <>If you have questions about the <b>{contactPeriod}</b> settlement, please contact the center at the email below.</>}
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <code className="flex-1 text-sm text-slate-800">{CENTER_EMAIL}</code>
              <button
                type="button"
                onClick={copyEmail}
                className="rounded-md bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"
              >
                {copied ? (ko ? "✓ 복사됨" : "✓ Copied") : (ko ? "복사" : "Copy")}
              </button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <a
                href={`mailto:${CENTER_EMAIL}?subject=${encodeURIComponent(`[Settlement Inquiry] ${contactPeriod}`)}`}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                {ko ? "이메일 보내기" : "Send email"}
              </a>
              <button
                type="button"
                onClick={() => setContactPeriod(null)}
                className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
              >
                {ko ? "닫기" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll info edit */}
      <form onSubmit={save} className="card space-y-4">
        <h2 className="text-base font-semibold">{ko ? "정산 정보" : "Payroll Info"}</h2>
        <p className="text-xs text-slate-500">
          {ko ? "정산액 계산에 사용됩니다. 센터 관리자만 볼 수 있습니다." : "Used to calculate your payment. Only admins can view these details."}
        </p>

        <div>
          <label className="label">{ko ? "시급 (KRW)" : "Hourly rate (KRW)"}</label>
          <input type="number" min={0} className="input" placeholder="e.g. 50000"
            value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
          {rate > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              = {rate.toLocaleString()} {ko ? "KRW / 수업 1시간" : "KRW per teaching hour"}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{ko ? "은행명" : "Bank name"}</label>
            <input className="input" placeholder="e.g. KB Kookmin Bank"
              value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </div>
          <div>
            <label className="label">{ko ? "예금주" : "Account holder"}</label>
            <input className="input" placeholder="Full name on the account"
              value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">{ko ? "계좌번호" : "Account number"}</label>
          <input className="input" placeholder="e.g. 123456-78-901234"
            value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
        </div>

        <button type="submit" className="btn w-full" disabled={pending}>
          {pending ? (ko ? "저장 중..." : "Saving...") : (ko ? "정산 정보 저장" : "Save payroll info")}
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

function Stat({
  label, value, highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={
      "rounded-md p-3 " +
      (highlight ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-700")
    }>
      <div className="text-xs opacity-75">{label}</div>
      <div className="mt-1 text-base font-bold">{value}</div>
    </div>
  );
}
