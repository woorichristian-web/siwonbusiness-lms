"use client";

import { useState } from "react";
import AdminUploadForm from "@/components/AdminUploadForm";
import AdminStudentUploadForm from "@/components/AdminStudentUploadForm";

type Tab = "schedule" | "students";

export default function AdminUploadTabs() {
  const [tab, setTab] = useState<Tab>("schedule");

  return (
    <div>
      {/* 탭 헤더 */}
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        <TabBtn active={tab === "schedule"} onClick={() => setTab("schedule")}>
          강사 시간표
        </TabBtn>
        <TabBtn active={tab === "students"} onClick={() => setTab("students")}>
          교육생 명단
        </TabBtn>
      </div>

      {/* 탭별 안내 + 폼 */}
      {tab === "schedule" ? (
        <>
          <FormatGuide
            title="강사 시간표 파일 형식"
            description="첫 행은 헤더(컬럼명)여야 하며, 다음 컬럼이 모두 필요합니다."
            rows={[
              ["teacher_username", "강사 아이디 (사전 등록 필요)", "jane_kim"],
              ["start_at", "시작 (Excel datetime 또는 ISO)", "2026-06-01 09:00"],
              ["end_at", "종료", "2026-06-01 10:00"],
              ["format", "online 또는 offline", "online"],
              ["class_type", "1on1 또는 small_group", "1on1"],
              ["capacity", "정원 (정수)", "1"],
            ]}
          />
          <AdminUploadForm />
        </>
      ) : (
        <>
          <FormatGuide
            title="교육생 명단 파일 형식"
            description="username, password, name 은 필수. 나머지는 선택. 우측 상단 '⬇ 템플릿 다운로드' 로 샘플 파일을 받으실 수 있습니다."
            rows={[
              ["username", "아이디 (영/숫자, 3~20자)", "kim123"],
              ["password", "임시 비밀번호 (8자 이상)", "kim1234567"],
              ["name", "이름", "김길동"],
              ["birth_date", "생년월일 (YYYY-MM-DD)", "1990-05-15"],
              ["phone", "연락처", "010-1234-5678"],
              ["residence_area", "주거 지역", "서울"],
              ["company_name", "회사명", "시원스쿨"],
              ["industry", "산업 분야", "IT/소프트웨어"],
              ["job_role", "직무 분야", "개발/엔지니어링"],
              ["learning_purpose", "영어 학습 목적", "비즈니스 이메일/문서 작성"],
              ["assigned_teacher_username", "배정 강사 아이디", "jane"],
              ["course_name", "수강 강좌명", "영어 회화 6개월 코스"],
              ["course_start_date", "수강 시작일 (YYYY-MM-DD)", "2026-06-01"],
              ["course_end_date", "수강 종료일 (YYYY-MM-DD)", "2026-11-30"],
              ["course_total_sessions", "수강 차시 (총 강좌수)", "24"],
              ["schedule", "예약할 수업 일정 (/로 구분, 강사 가능시간 안의 시각)", "2026-06-01 09:00 / 2026-06-08 09:00"],
            ]}
          />
          <AdminStudentUploadForm />
        </>
      )}
    </div>
  );
}

function TabBtn({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "px-4 py-2 text-sm font-medium transition border-b-2 -mb-px " +
        (active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-700")
      }
    >
      {children}
    </button>
  );
}

function FormatGuide({
  title, description, rows,
}: {
  title: string;
  description: string;
  rows: [string, string, string][];
}) {
  return (
    <section className="card mb-4">
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
      <p className="mb-3 text-sm text-slate-600">{description}</p>
      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">컬럼명</th>
              <th className="px-3 py-2">의미</th>
              <th className="px-3 py-2">예시</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(([k, v, e], i) => (
              <tr key={i}>
                <td className="px-3 py-2 font-mono text-xs">{k}</td>
                <td className="px-3 py-2">{v}</td>
                <td className="px-3 py-2 text-slate-500">{e}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
