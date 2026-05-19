"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminCreateUser } from "@/lib/actions/admin";
import { REGIONS, INDUSTRIES, JOB_ROLES, LEARNING_PURPOSES } from "@/lib/constants";
import type { Role } from "@/lib/types";
import BirthDateInput from "@/components/BirthDateInput";
import PhoneInput from "@/components/PhoneInput";

interface TeacherOption {
  id: string;
  name: string;
  username: string;
}

export default function AdminUserAddForm({ teachers = [] }: { teachers?: TeacherOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [role, setRole] = useState<Role>("student");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [purpose, setPurpose] = useState("");
  const [prefFormat, setPrefFormat] = useState("");
  const [prefType, setPrefType] = useState("");

  // 수강 정보
  const [assignedTeacher, setAssignedTeacher] = useState("");
  const [courseName, setCourseName] = useState("");
  const [courseStart, setCourseStart] = useState("");
  const [courseEnd, setCourseEnd] = useState("");
  const [courseTotal, setCourseTotal] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const prefArr = [prefFormat, prefType].filter(Boolean);
      const r = await adminCreateUser({
        role, name, username, password,
        birth_date: birthDate || undefined,
        phone: phone || undefined,
        residence_area: region || undefined,
        company_name: company || undefined,
        industry: industry || undefined,
        job_role: jobRole || undefined,
        learning_purpose: purpose || undefined,
        preferred_format: prefArr,
        assigned_teacher_id: assignedTeacher || null,
        course_name: courseName.trim() || null,
        course_start_date: courseStart || null,
        course_end_date: courseEnd || null,
        course_total_sessions: courseTotal.trim() === "" ? null : Number(courseTotal),
      });
      if (!r.ok) { setError(r.error ?? "실패"); return; }
      setSuccess(`${name} (${username}) 계정 생성 완료`);
      setName(""); setUsername(""); setPassword("");
      setBirthDate(""); setPhone("");
      setRegion(""); setCompany(""); setIndustry(""); setJobRole(""); setPurpose("");
      setPrefFormat(""); setPrefType("");
      setAssignedTeacher(""); setCourseName(""); setCourseStart(""); setCourseEnd(""); setCourseTotal("");
      router.refresh();
    });
  }

  const isStudent = role === "student";

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>
      )}

      <section className="card space-y-4">
        <h2 className="text-base font-semibold">계정 정보</h2>

        <div>
          <label className="label">역할</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="student">교육생</option>
            <option value="teacher">강사</option>
            <option value="admin">관리자</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">이름 *</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">생년월일</label>
            <BirthDateInput value={birthDate} onChange={setBirthDate} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">아이디 * (영/숫자, 3~20자)</label>
            <input className="input" required minLength={3} maxLength={20}
              value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="label">임시 비밀번호 * (8자 이상)</label>
            <input className="input" required minLength={8}
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">연락처</label>
          <PhoneInput value={phone} onChange={setPhone} />
        </div>
      </section>

      {isStudent && (
        <section className="card space-y-4">
          <h2 className="text-base font-semibold">교육생 추가 정보</h2>

          <div>
            <label className="label">주거 지역</label>
            <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">선택</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

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

          <div>
            <label className="label">영어 학습 목적</label>
            <select className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option value="">선택</option>
              {LEARNING_PURPOSES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">선호 수업 방식</label>
              <select className="input" value={prefFormat} onChange={(e) => setPrefFormat(e.target.value)}>
                <option value="">선택</option>
                <option value="online">온라인</option>
                <option value="offline">오프라인</option>
              </select>
            </div>
            <div>
              <label className="label">선호 수업 형태</label>
              <select className="input" value={prefType} onChange={(e) => setPrefType(e.target.value)}>
                <option value="">선택</option>
                <option value="1on1">1:1</option>
                <option value="small_group">소그룹 (small group)</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {isStudent && (
        <section className="card space-y-4">
          <header>
            <h2 className="text-base font-semibold">📚 수강정보입력</h2>
            <p className="mt-1 text-xs text-slate-500">
              관리자가 직접 입력하는 영역입니다. 교육생 회원가입 폼에는 노출되지 않습니다.
            </p>
          </header>

          <div>
            <label className="label">배정 강사</label>
            <select className="input" value={assignedTeacher}
              onChange={(e) => setAssignedTeacher(e.target.value)}>
              <option value="">미배정</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.username})</option>
              ))}
            </select>
            {teachers.length === 0 && (
              <p className="mt-1 text-xs text-slate-400">
                등록된 강사가 없습니다. 강사 계정을 먼저 만들어주세요.
              </p>
            )}
          </div>

          <div>
            <label className="label">수강 강좌명</label>
            <input className="input" placeholder="예: 영어 회화 6개월 코스"
              value={courseName} onChange={(e) => setCourseName(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">수강 시작일</label>
              <input type="date" className="input" value={courseStart}
                onChange={(e) => setCourseStart(e.target.value)} />
            </div>
            <div>
              <label className="label">수강 종료일</label>
              <input type="date" className="input" value={courseEnd}
                onChange={(e) => setCourseEnd(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">수강 차시 (총 강좌수)</label>
            <input type="number" min={0} className="input" placeholder="예: 24"
              value={courseTotal} onChange={(e) => setCourseTotal(e.target.value)} />
          </div>
        </section>
      )}

      <button type="submit" className="btn w-full" disabled={pending}>
        {pending ? "생성 중..." : "계정 생성"}
      </button>
    </form>
  );
}
