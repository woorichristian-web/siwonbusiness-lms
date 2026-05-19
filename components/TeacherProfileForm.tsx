"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMyProfile, updateMyTeacher, changeMyPassword } from "@/lib/actions/profile";
import type { Profile, Teacher } from "@/lib/types";
import BirthDateInput from "@/components/BirthDateInput";
import PhoneInput from "@/components/PhoneInput";

interface PayrollStats {
  totalCompleted: number;
  totalHours: number;
  thisMonthCompleted: number;
  thisMonthHours: number;
}

export default function TeacherProfileForm({
  profile,
  teacher,
  stats,
}: {
  profile: Profile;
  teacher: Teacher | null;
  stats: PayrollStats;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Basic profile fields
  const [name, setName] = useState(profile.name ?? "");
  const [birth, setBirth] = useState(profile.birth_date ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");

  // Teacher payroll fields
  const [bio, setBio] = useState(teacher?.bio ?? "");
  const [specialty, setSpecialty] = useState(teacher?.specialty ?? "");
  const [hourlyRate, setHourlyRate] = useState(
    teacher?.hourly_rate != null ? String(teacher.hourly_rate) : ""
  );
  const [bankName, setBankName] = useState(teacher?.bank_name ?? "");
  const [bankAccount, setBankAccount] = useState(teacher?.bank_account ?? "");
  const [accountHolder, setAccountHolder] = useState(teacher?.account_holder ?? "");

  // Password change
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      // 1) Update profile basic info
      const r1 = await updateMyProfile({
        name,
        birth_date: birth || null,
        phone: phone || null,
      });
      if (!r1.ok) { setMsg({ type: "err", text: r1.error ?? "Failed to update profile" }); return; }

      // 2) Update teacher payroll info
      const r2 = await updateMyTeacher({
        bio: bio.trim() || null,
        specialty: specialty.trim() || null,
        hourly_rate: hourlyRate.trim() === "" ? null : Number(hourlyRate),
        bank_name: bankName.trim() || null,
        bank_account: bankAccount.trim() || null,
        account_holder: accountHolder.trim() || null,
      });
      if (!r2.ok) { setMsg({ type: "err", text: r2.error ?? "Failed to update payroll info" }); return; }

      setMsg({ type: "ok", text: "Your information has been saved." });
      router.refresh();
    });
  }

  function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!pw1 || !pw2) return setMsg({ type: "err", text: "Please enter a new password." });
    if (pw1 !== pw2) return setMsg({ type: "err", text: "Passwords do not match." });
    if (pw1.length < 8) return setMsg({ type: "err", text: "Password must be at least 8 characters." });
    startTransition(async () => {
      const r = await changeMyPassword(pw1);
      if (!r.ok) { setMsg({ type: "err", text: r.error ?? "Failed to change password" }); return; }
      setMsg({ type: "ok", text: "Password changed successfully." });
      setPw1(""); setPw2("");
    });
  }

  const rate = Number(hourlyRate) || 0;
  const estimatedThisMonth = Math.round(rate * stats.thisMonthHours);
  const estimatedTotal = Math.round(rate * stats.totalHours);

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

      {/* Account info (read-only) */}
      <section className="card">
        <h2 className="mb-3 text-base font-semibold">Account</h2>
        <div className="space-y-1 text-sm">
          <ReadRow k="Username" v={profile.username} />
          <ReadRow k="Role" v="Teacher" />
          <ReadRow k="Joined" v={new Date(profile.created_at).toLocaleDateString("en-US")} />
        </div>
      </section>

      {/* Payment summary (read-only) */}
      <section className="card">
        <h2 className="mb-3 text-base font-semibold">💰 Payment Summary</h2>
        <p className="mb-3 text-xs text-slate-500">
          Based on attendance records (only "Present" and "Late" count as completed).
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total classes" value={String(stats.totalCompleted)} />
          <Stat label="Total hours" value={stats.totalHours.toFixed(1)} />
          <Stat label="This month" value={`${stats.thisMonthCompleted} (${stats.thisMonthHours.toFixed(1)}h)`} />
          <Stat
            label="Est. this month"
            value={rate > 0 ? `${estimatedThisMonth.toLocaleString()} KRW` : "Set rate"}
            highlight={rate > 0}
          />
        </div>
        {rate > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Estimated total earnings to date: <b className="text-slate-700">{estimatedTotal.toLocaleString()} KRW</b>
            {" "}({stats.totalHours.toFixed(1)} h × {rate.toLocaleString()} KRW/h)
          </p>
        )}
      </section>

      {/* Profile + payroll form */}
      <form onSubmit={saveProfile} className="space-y-6">
        <section className="card space-y-4">
          <h2 className="text-base font-semibold">Basic Info</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Name</label>
              <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Date of birth</label>
              <BirthDateInput value={birth} onChange={setBirth} />
            </div>
          </div>

          <div>
            <label className="label">Phone</label>
            <PhoneInput value={phone} onChange={setPhone} />
          </div>
        </section>

        <section className="card space-y-4">
          <h2 className="text-base font-semibold">Profile</h2>

          <div>
            <label className="label">Specialty</label>
            <input className="input" placeholder="e.g. Business English, IELTS prep"
              value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
          </div>

          <div>
            <label className="label">Bio (shown to admins; not yet shown to students)</label>
            <textarea className="input min-h-[100px]"
              placeholder="A short introduction about your background and teaching style."
              value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
        </section>

        <section className="card space-y-4">
          <h2 className="text-base font-semibold">Payroll</h2>
          <p className="text-xs text-slate-500">
            Used to calculate your payment. Only the admin can view these details from the admin panel.
          </p>

          <div>
            <label className="label">Hourly rate (KRW)</label>
            <input type="number" min={0} className="input" placeholder="e.g. 50000"
              value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
            {rate > 0 && (
              <p className="mt-1 text-xs text-slate-400">
                = {rate.toLocaleString()} KRW per teaching hour
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Bank name</label>
              <input className="input" placeholder="e.g. KB Kookmin Bank"
                value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div>
              <label className="label">Account holder</label>
              <input className="input" placeholder="Full name on the account"
                value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Account number</label>
            <input className="input" placeholder="e.g. 123456-78-901234"
              value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
          </div>
        </section>

        <button type="submit" className="btn w-full" disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </button>
      </form>

      {/* Password change */}
      <form onSubmit={savePassword} className="card space-y-4">
        <h2 className="text-base font-semibold">Change password</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">New password</label>
            <input type="password" className="input" minLength={8}
              value={pw1} onChange={(e) => setPw1(e.target.value)} />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input type="password" className="input" minLength={8}
              value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="btn" disabled={pending || !pw1 || !pw2}>
          {pending ? "Changing..." : "Change password"}
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
