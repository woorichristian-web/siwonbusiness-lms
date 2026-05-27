"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import type { Profile, CompanySettings, CompanyHoliday } from "@/lib/types";
import {
  upsertCompanySettings,
  addHoliday,
  deleteHoliday,
  updateMemberAdminFields,
} from "@/lib/actions/company";
import { REGIONS, INDUSTRIES, JOB_ROLES } from "@/lib/constants";
import PhoneInput from "@/components/PhoneInput";
import MemberEditModal from "@/components/MemberEditModal";

interface Props {
  companies: string[];
  selectedCompany: string;
  teachers: Profile[];
  members: Profile[];
  settings: CompanySettings | null;
  holidays: CompanyHoliday[];
  bookingsByMember: Record<string, string[]>;
}

export default function CompanyAdminClient(props: Props) {
  const router = useRouter();
  const { companies, selectedCompany, teachers, members, settings, holidays, bookingsByMember } = props;

  function onCompanyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    router.push(v ? `/admin/companies/${encodeURIComponent(v)}` : "/admin/companies");
  }

  if (companies.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
        아직 등록된 기업이 없습니다. 교육생 회원가입이 일어나야 기업이 자동으로 추가됩니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 기업 선택 */}
      <div className="card flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-slate-700">기업 선택:</label>
        <select className="input max-w-xs" value={selectedCompany} onChange={onCompanyChange}>
          {companies.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <span className="text-xs text-slate-400">· 회원 {members.length}명</span>
        {selectedCompany && (
          <a
            href={`/admin/progress/company?company=${encodeURIComponent(selectedCompany)}`}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs text-brand-700 hover:bg-brand-100"
          >
            📊 전체 회원 Progress Reports ZIP →
          </a>
        )}
      </div>

      {selectedCompany && (
        <>
          <SettingsCards
            company={selectedCompany}
            teachers={teachers}
            settings={settings}
          />
          <HolidaysCard
            company={selectedCompany}
            holidays={holidays}
          />
          <MembersCard
            company={selectedCompany}
            members={members}
            teachers={teachers}
            bookingsByMember={bookingsByMember}
            totalSessions={settings?.total_sessions ?? null}
          />
        </>
      )}
    </div>
  );
}

// =====================================================================
// 1) 과정 / 강사 / 차시 설정
// =====================================================================
function SettingsCards({
  company, teachers, settings,
}: {
  company: string;
  teachers: Profile[];
  settings: CompanySettings | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // 빈 배열 = 전체 허용
  const [classTypes, setClassTypes] = useState<string[]>(settings?.allowed_class_types ?? []);
  const [formats, setFormats] = useState<string[]>(settings?.allowed_formats ?? []);
  const [teacherIds, setTeacherIds] = useState<string[]>(settings?.allowed_teacher_ids ?? []);
  const [totalSessions, setTotalSessions] = useState<string>(
    settings?.total_sessions != null ? String(settings.total_sessions) : ""
  );
  const [centerManaged, setCenterManaged] = useState<boolean>(
    settings?.center_managed_registration ?? false
  );

  function toggle<T extends string>(arr: T[], setArr: (a: T[]) => void, v: T) {
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await upsertCompanySettings({
        company_name: company,
        allowed_class_types: classTypes as any,
        allowed_formats: formats as any,
        allowed_teacher_ids: teacherIds,
        total_sessions: totalSessions.trim() === "" ? null : Number(totalSessions),
        center_managed_registration: centerManaged,
      });
      if (!r.ok) { setError(r.error ?? "저장 실패"); return; }
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* 과정 설정 */}
      <section className="card">
        <h3 className="mb-1 font-semibold">과정 설정</h3>
        <p className="mb-3 text-xs text-slate-500">
          해당 기업 교육생이 신청 가능한 수업 형태/방식. 미체크 = 전부 허용.
        </p>
        <div className="space-y-2">
          <Pill checked={classTypes.includes("1on1")} onClick={() => toggle(classTypes, setClassTypes, "1on1")} label="1:1" />
          <Pill checked={classTypes.includes("small_group")} onClick={() => toggle(classTypes, setClassTypes, "small_group")} label="소그룹" />
          <hr className="my-2 border-slate-100" />
          <Pill checked={formats.includes("online")} onClick={() => toggle(formats, setFormats, "online")} label="온라인" />
          <Pill checked={formats.includes("offline")} onClick={() => toggle(formats, setFormats, "offline")} label="오프라인" />
        </div>
      </section>

      {/* 강사 설정 */}
      <section className="card">
        <h3 className="mb-1 font-semibold">강사 설정</h3>
        <p className="mb-3 text-xs text-slate-500">
          선택된 강사의 수업만 교육생에게 노출. 미체크 = 전부 허용.
        </p>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {teachers.length === 0 && <p className="text-xs text-slate-400">등록된 강사가 없습니다.</p>}
          {teachers.map((t) => (
            <Pill key={t.id}
              checked={teacherIds.includes(t.id)}
              onClick={() => toggle(teacherIds, setTeacherIds, t.id)}
              label={t.name} />
          ))}
        </div>
      </section>

      {/* 차시 설정 */}
      <section className="card">
        <h3 className="mb-1 font-semibold">차시 설정</h3>
        <p className="mb-3 text-xs text-slate-500">
          교육생 1인당 등록 가능한 차시 총수. 비워두면 무제한.
        </p>
        <input type="number" min={0} className="input" placeholder="예: 24"
          value={totalSessions} onChange={(e) => setTotalSessions(e.target.value)} />
        <p className="mt-2 text-xs text-slate-400">
          {totalSessions.trim() === "" ? "현재: 무제한" : `현재: 교육생 1인당 ${totalSessions}회`}
        </p>
      </section>

      {/* 수강신청 대행 설정 */}
      <section className="card md:col-span-3">
        <div className="flex items-start gap-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={centerManaged}
              onChange={(e) => setCenterManaged(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm font-semibold text-slate-700">
              센터(기업)가 수강신청을 대행
            </span>
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          체크 시 — 해당 기업 교육생은 <b>'수강신청'</b> 메뉴에서 직접 신청할 수 없고,
          <i>"귀하의 수강신청은 귀사에서 대신합니다."</i> 안내만 표시됩니다.
          관리자가 회원 페이지 또는 일괄 업로드로 대신 신청해주세요.
        </p>
        <p className="mt-1 text-xs text-amber-600">
          현재: <b>{centerManaged ? "센터 대행 (학생 직접 신청 불가)" : "학생 직접 신청 허용"}</b>
        </p>
      </section>

      <div className="md:col-span-3 flex items-center justify-end gap-3">
        {error && <span className="text-sm text-red-600">{error}</span>}
        {savedAt && !error && <span className="text-xs text-green-600">저장됨 · {savedAt}</span>}
        <button className="btn" onClick={save} disabled={pending}>
          {pending ? "저장 중..." : "설정 저장"}
        </button>
      </div>
    </div>
  );
}

function Pill({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={"mr-2 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition " +
        (checked ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-brand-500")}>
      <span>{checked ? "✓" : "○"}</span> {label}
    </button>
  );
}

// =====================================================================
// 2) 휴일 설정
// =====================================================================
function HolidaysCard({ company, holidays }: { company: string; holidays: CompanyHoliday[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    setError(null);
    if (!date) return setError("날짜를 입력하세요.");
    startTransition(async () => {
      const r = await addHoliday({ company_name: company, holiday_date: date, reason });
      if (!r.ok) { setError(r.error ?? "추가 실패"); return; }
      setDate(""); setReason("");
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("이 휴일을 삭제할까요?")) return;
    startTransition(async () => {
      const r = await deleteHoliday(id);
      if (!r.ok) setError(r.error ?? "삭제 실패");
      else router.refresh();
    });
  }

  return (
    <section className="card">
      <h3 className="mb-1 font-semibold">휴일 설정</h3>
      <p className="mb-3 text-xs text-slate-500">
        등록된 날짜에는 교육생이 수강 신청을 할 수 없습니다.
      </p>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr_auto]">
        <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="input" placeholder="사유 (예: 창립기념일)"
          value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="btn" onClick={add} disabled={pending}>+ 추가</button>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      {holidays.length === 0 ? (
        <p className="text-sm text-slate-400">등록된 휴일이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {holidays.map((h) => (
            <li key={h.id} className="flex items-center justify-between py-2">
              <div>
                <span className="font-medium">{h.holiday_date}</span>
                {h.reason && <span className="ml-2 text-slate-500">— {h.reason}</span>}
              </div>
              <button className="text-xs text-red-600 hover:underline"
                onClick={() => remove(h.id)} disabled={pending}>삭제</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// =====================================================================
// 3) 회원 목록 + 편집 + Excel 다운로드
// =====================================================================
function MembersCard({
  company, members, teachers, bookingsByMember, totalSessions,
}: {
  company: string;
  members: Profile[];
  teachers: Profile[];
  bookingsByMember: Record<string, string[]>;
  totalSessions: number | null;
}) {
  const [editing, setEditing] = useState<Profile | null>(null);
  const teacherById = useMemo(
    () => Object.fromEntries(teachers.map((t) => [t.id, t.name])),
    [teachers]
  );

  function exportExcel() {
    const rows = members.map((m) => {
      const dates = (bookingsByMember[m.id] ?? [])
        .map((iso) => new Date(iso))
        .sort((a, b) => a.getTime() - b.getTime())
        .map((d) => d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }));
      const doneCount = dates.length;
      const remaining = totalSessions == null ? "무제한" : Math.max(0, totalSessions - doneCount);
      return {
        "기업명": m.company_name ?? "",
        "이름": m.name,
        "주거 지역": m.residence_area ?? "",
        "분야": m.industry ?? "",
        "직군": m.job_role ?? "",
        "학습 목적": m.learning_purpose ?? "",
        "선호 방식": (m.preferred_format ?? []).join(", "),
        "선호 시간": (m.preferred_time ?? []).join(", "),
        "연락처": m.phone ?? "",
        "배정 강사": m.assigned_teacher_id ? (teacherById[m.assigned_teacher_id] ?? "") : "",
        "신청 날짜 (이른순)": dates.join(" / "),
        "수강완료차수": doneCount,
        "남은 수강일수": remaining,
        "특이사항": m.admin_notes ?? "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, company.slice(0, 28));
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${company}_회원명단_${today}.xlsx`);
  }

  return (
    <section className="card">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{company} 회원 목록 ({members.length}명)</h3>
        <button className="btn" onClick={exportExcel} disabled={members.length === 0}>
          ⬇ Excel 다운로드
        </button>
      </header>

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">이름</th>
              <th className="px-3 py-2">아이디</th>
              <th className="px-3 py-2">연락처</th>
              <th className="px-3 py-2">분야/직군</th>
              <th className="px-3 py-2">배정 강사</th>
              <th className="px-3 py-2">수강현황</th>
              <th className="px-3 py-2">특이사항</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">소속 회원이 없습니다.</td></tr>
            )}
            {members.map((m) => {
              const dates = bookingsByMember[m.id] ?? [];
              return (
                <tr key={m.id}>
                  <td className="px-3 py-2 font-medium text-slate-800">{m.name}</td>
                  <td className="px-3 py-2 text-slate-600">{m.username}</td>
                  <td className="px-3 py-2 text-slate-600">{m.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {(m.industry ?? "—")}{m.job_role ? " / " + m.job_role : ""}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {m.assigned_teacher_id ? teacherById[m.assigned_teacher_id] ?? "—" : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {dates.length} {totalSessions != null ? `/ ${totalSessions}` : ""}
                  </td>
                  <td className="px-3 py-2 max-w-[16rem] truncate text-slate-600">
                    {m.admin_notes ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button className="text-xs text-brand-600 hover:underline"
                      onClick={() => setEditing(m)}>편집</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <MemberEditModal
          member={editing}
          teachers={teachers}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

