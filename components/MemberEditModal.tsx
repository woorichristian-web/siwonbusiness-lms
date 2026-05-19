"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import { updateMemberAdminFields } from "@/lib/actions/company";
import { REGIONS, INDUSTRIES, JOB_ROLES } from "@/lib/constants";
import PhoneInput from "@/components/PhoneInput";

/**
 * 관리자가 한 회원의 정보를 편집하는 모달.
 * - 기본 정보: 이름, 연락처, 주거지역, 분야/직군, 배정 강사, 특이사항
 * - 수강 정보: 강좌명, 시작/종료일, 총 차시
 */
export default function MemberEditModal({
  member, teachers, onClose,
}: {
  member: Profile;
  teachers: Pick<Profile, "id" | "name">[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [region, setRegion] = useState(member.residence_area ?? "");
  const [industry, setIndustry] = useState(member.industry ?? "");
  const [jobRole, setJobRole] = useState(member.job_role ?? "");
  const [assignedTeacher, setAssignedTeacher] = useState(member.assigned_teacher_id ?? "");
  const [notes, setNotes] = useState(member.admin_notes ?? "");

  const [courseName, setCourseName] = useState(member.course_name ?? "");
  const [courseStart, setCourseStart] = useState(member.course_start_date ?? "");
  const [courseEnd, setCourseEnd] = useState(member.course_end_date ?? "");
  const [courseTotal, setCourseTotal] = useState(
    member.course_total_sessions != null ? String(member.course_total_sessions) : ""
  );

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await updateMemberAdminFields(member.id, {
        name: name.trim(),
        phone: phone.trim() || null,
        residence_area: region || null,
        industry: industry || null,
        job_role: jobRole || null,
        assigned_teacher_id: assignedTeacher || null,
        admin_notes: notes.trim() || null,
        course_name: courseName.trim() || null,
        course_start_date: courseStart || null,
        course_end_date: courseEnd || null,
        course_total_sessions: courseTotal.trim() === "" ? null : Number(courseTotal),
      });
      if (!r.ok) { setError(r.error ?? "저장 실패"); return; }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={save}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-bold">{member.name} ({member.username}) 정보 편집</h3>

        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>
        )}

        <div className="space-y-3">
          <div>
            <label className="label">이름</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">분야</label>
              <select className="input" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                <option value="">선택</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="label">직군</label>
              <select className="input" value={jobRole} onChange={(e) => setJobRole(e.target.value)}>
                <option value="">선택</option>
                {JOB_ROLES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">배정 강사</label>
            <select className="input" value={assignedTeacher}
              onChange={(e) => setAssignedTeacher(e.target.value)}>
              <option value="">미배정</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <h4 className="mb-2 text-sm font-semibold text-slate-700">📚 수강 강좌 정보</h4>
            <div className="space-y-2">
              <div>
                <label className="label">강좌명</label>
                <input className="input" placeholder="예: 영어 회화 6개월 코스"
                  value={courseName} onChange={(e) => setCourseName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">시작일</label>
                  <input type="date" className="input" value={courseStart}
                    onChange={(e) => setCourseStart(e.target.value)} />
                </div>
                <div>
                  <label className="label">종료일</label>
                  <input type="date" className="input" value={courseEnd}
                    onChange={(e) => setCourseEnd(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">총 강좌수 (차시)</label>
                <input type="number" min={0} className="input" placeholder="예: 24"
                  value={courseTotal} onChange={(e) => setCourseTotal(e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <label className="label">특이사항 (관리자 메모)</label>
            <textarea className="input min-h-[100px]" placeholder="이 회원에 대한 메모를 자유롭게 작성"
              value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>취소</button>
          <button type="submit" className="btn" disabled={pending}>
            {pending ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
