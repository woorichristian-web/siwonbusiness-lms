"use client";

import { useState } from "react";
import AdminUploadForm from "@/components/AdminUploadForm";
import AdminStudentUploadForm from "@/components/AdminStudentUploadForm";
import AdminTeacherUploadForm from "@/components/AdminTeacherUploadForm";
import AdminDbDownload from "@/components/AdminDbDownload";

type Tab = "students" | "teachers" | "schedule" | "download";

export default function AdminUploadTabs({ companies }: { companies: string[] }) {
  const [tab, setTab] = useState<Tab>("students");

  return (
    <div>
      {/* 탭 헤더 */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        <TabBtn active={tab === "students"} onClick={() => setTab("students")}>
          🎓 교육생 업로드
        </TabBtn>
        <TabBtn active={tab === "teachers"} onClick={() => setTab("teachers")}>
          👨‍🏫 강사 정보 업로드
        </TabBtn>
        <TabBtn active={tab === "schedule"} onClick={() => setTab("schedule")}>
          🗓️ 강사 시간표 업로드
        </TabBtn>
        <TabBtn active={tab === "download"} onClick={() => setTab("download")}>
          📥 DB 내려받기
        </TabBtn>
      </div>

      {tab === "students" && (
        <>
          <FormatGuide
            title="교육생 명단 업로드"
            description="username, password, name 은 필수. 나머지는 선택. '⬇ 템플릿 다운로드' 로 샘플 받기. 한 번 업로드하면 회원 관리·기업별 관리에 모두 자동 반영됩니다."
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
              ["course_start_date", "수강 시작일", "2026-06-01"],
              ["course_end_date", "수강 종료일", "2026-11-30"],
              ["course_total_sessions", "총 차시", "24"],
              ["schedule", "수업 시간 (/로 구분)", "2026-06-01 09:00 / 2026-06-08 09:00"],
            ]}
          />
          <AdminStudentUploadForm />
        </>
      )}

      {tab === "teachers" && (
        <>
          <FormatGuide
            title="강사 정보 업로드"
            description="강사 계정과 프로필을 일괄 생성/갱신. username·name 은 필수, password 는 신규 계정일 때만 필수 (기존 계정 업데이트 시 비워두면 그대로). zoom_url / teams_url 을 입력하면 학생 카드에 '바로 입장' 버튼이 자동으로 활성화됩니다."
            rows={[
              ["username", "강사 아이디 (영/숫자, 3~20자)", "jane_kim"],
              ["password", "임시 비밀번호 (신규만 필수, 8자 이상)", "Teacher1234!"],
              ["name", "이름", "Jane Kim"],
              ["birth_date", "생년월일 (YYYY-MM-DD)", "1985-03-12"],
              ["phone", "연락처", "010-1111-2222"],
              ["residence_area", "주거 지역", "서울"],
              ["specialty", "전문 분야", "Business Conversation"],
              ["bio", "강사 소개 (자유 텍스트)", "Native speaker, 8 yrs ESL"],
              ["hourly_rate", "시급 (원, 정수)", "35000"],
              ["bank_name", "정산 계좌 은행", "신한은행"],
              ["bank_account", "정산 계좌 번호", "110-123-456789"],
              ["account_holder", "예금주", "김제인"],
              ["zoom_url", "Zoom 회의실 URL", "https://zoom.us/j/9876543210?pwd=..."],
              ["teams_url", "Teams 회의실 URL", "https://teams.microsoft.com/l/meetup-join/..."],
            ]}
          />
          <AdminTeacherUploadForm />
        </>
      )}

      {tab === "schedule" && (
        <>
          <FormatGuide
            title="강사 시간표 업로드"
            description="강사의 가능 시간 슬롯을 일괄 등록. 강사가 직접 시간을 입력하지 않을 때 사용."
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
      )}

      {tab === "download" && <AdminDbDownload companies={companies} />}
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
