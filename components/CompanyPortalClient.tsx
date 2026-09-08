"use client";

// 기업 담당자(마스터 계정) 화면 — 자기 회사 과정 카드 리스트.
// 센터 과정 관리와 같은 카드 스타일이지만 수정 기능은 전혀 없다(읽기 전용).
// 카드를 클릭하면 과정 상세 정보 + 교육생별 출석률 리스트가 펼쳐진다.
import { useState } from "react";

export interface CompanyStudentRow {
  id: string;
  name: string;
  english_name: string | null;
  done: number;              // 지난(진행된) 차시
  rate: number | null;       // 출석률 %
}

export interface CompanyCourseData {
  id: string;
  name: string;
  code: string | null;
  language: string | null;
  textbook: string | null;
  class_type_ko: string | null;
  format: string | null;     // "온라인" | "오프라인" | null
  capacity: number | null;
  start_date: string | null;
  end_date: string | null;
  schedule: string | null;   // "화 09:00 · 금 10:00" 형식
  duration_min: number | null;
  total_sessions: number | null;
  teachers: string[];
  surveyAvg: { avg: number; count: number } | null;
  students: CompanyStudentRow[];
}

export default function CompanyPortalClient({ courses }: { courses: CompanyCourseData[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (courses.length === 0) {
    return <div className="card text-center text-sm text-slate-400">진행 중인 과정이 없습니다.</div>;
  }

  return (
    <div className="space-y-4">
      {courses.map((c) => {
        const open = openId === c.id;
        return (
          <section key={c.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {/* 카드 헤더 — 센터 과정 카드와 같은 구성 (버튼 없음) */}
            <button
              type="button"
              onClick={() => setOpenId(open ? null : c.id)}
              className="block w-full px-5 py-4 text-left transition hover:bg-slate-50/60"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold text-slate-800">{c.name}</span>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                  교육생 {c.students.length}명
                </span>
                {c.code && (
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">{c.code}</span>
                )}
                {c.surveyAvg && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    만족도 {c.surveyAvg.avg}/10
                  </span>
                )}
                <span className="ml-auto shrink-0 text-xs text-slate-400">{open ? "접기 ▲" : "자세히 ▼"}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {c.language && <span>{c.language}</span>}
                {c.textbook && <span>교재 {c.textbook}</span>}
                {c.class_type_ko && <span>{c.class_type_ko}</span>}
                {c.format && <span>{c.format}</span>}
                {c.capacity != null && <span>정원 {c.capacity}</span>}
                <span>기간 {c.start_date ?? "?"} ~ {c.end_date ?? "?"}</span>
                {c.schedule && <span>{c.schedule}{c.duration_min ? ` · ${c.duration_min}분` : ""}</span>}
                {c.total_sessions != null && <span>총 {c.total_sessions}차시</span>}
              </div>
              <div className="mt-1.5 text-xs text-slate-500">
                배정 강사{" "}
                {c.teachers.length > 0 ? (
                  c.teachers.map((t) => (
                    <span key={t} className="mr-1 rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">{t}</span>
                  ))
                ) : (
                  <span className="text-slate-400">미배정</span>
                )}
              </div>
            </button>

            {/* 상세 — 과정 정보 + 교육생 출석률 */}
            {open && (
              <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                  <InfoItem k="과정명" v={c.name} wide />
                  <InfoItem k="강좌코드" v={c.code ?? "—"} />
                  <InfoItem k="언어" v={c.language ?? "—"} />
                  <InfoItem k="교재" v={c.textbook ?? "—"} />
                  <InfoItem k="수업 형태" v={c.class_type_ko ?? "—"} />
                  <InfoItem k="진행 방식" v={c.format ?? "—"} />
                  <InfoItem k="정원" v={c.capacity != null ? `${c.capacity}명` : "—"} />
                  <InfoItem k="기간" v={`${c.start_date ?? "?"} ~ ${c.end_date ?? "?"}`} />
                  <InfoItem k="요일 · 시간" v={c.schedule ?? "—"} />
                  <InfoItem k="수업 길이" v={c.duration_min ? `${c.duration_min}분` : "—"} />
                  <InfoItem k="전체 차시" v={c.total_sessions != null ? `${c.total_sessions}차시` : "—"} />
                  <InfoItem k="배정 강사" v={c.teachers.join(", ") || "미배정"} />
                  {c.surveyAvg && (
                    <InfoItem k="만족도" v={`${c.surveyAvg.avg}/10 (응답 ${c.surveyAvg.count}건)`} />
                  )}
                </dl>

                <h3 className="mb-2 text-sm font-semibold text-slate-700">교육생 ({c.students.length}명)</h3>
                {c.students.length === 0 ? (
                  <p className="py-3 text-center text-sm text-slate-400">등록된 교육생이 없습니다.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                          <th className="px-3 py-2">이름</th>
                          <th className="px-3 py-2">영어 이름</th>
                          <th className="px-3 py-2 text-center">진행 차시</th>
                          <th className="px-3 py-2 text-center">출석률</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.students.map((s) => (
                          <tr key={s.id} className="border-b border-slate-100 last:border-b-0">
                            <td className="px-3 py-2 font-medium text-slate-800">{s.name}</td>
                            <td className="px-3 py-2 text-slate-500">{s.english_name ?? "—"}</td>
                            <td className="px-3 py-2 text-center text-slate-600">
                              {s.done}{c.total_sessions != null ? ` / ${c.total_sessions}` : ""}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {s.rate != null ? (
                                <span className={"font-semibold " + (s.rate >= 80 ? "text-emerald-600" : s.rate >= 50 ? "text-amber-600" : "text-red-500")}>
                                  {s.rate}%
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function InfoItem({ k, v, wide = false }: { k: string; v: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 sm:col-span-3" : ""}>
      <dt className="text-[11px] text-slate-400">{k}</dt>
      <dd className="font-medium text-slate-800">{v}</dd>
    </div>
  );
}
