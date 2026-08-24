"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { getTeacherPayrollReport } from "@/lib/actions/teacher-report";
import { buildTeacherPayrollXlsx } from "@/lib/reportXlsx";
import { getCourseTeacherEvalAdmin } from "@/lib/actions/teacher-eval";

export interface TeacherRow {
  id: string;
  name: string;
  username: string;
  classes: number;
  courses: number;
  ratingAvg: number | null;
  ratingCount: number;
}
export interface TeacherGroup {
  key: string;
  title: string;        // 과정명 (미배정 그룹은 "미배정 강사")
  company: string | null;
  teachers: TeacherRow[];
}
interface Dashboard {
  teacherCount: number;
  avgSatisfaction: number | null;
  ratingCount: number;
  totalCourses: number;
  totalClasses: number;
}

export default function TeacherManageList({
  groups,
  dashboard,
}: {
  groups: TeacherGroup[];
  dashboard: Dashboard;
}) {
  const [q, setQ] = useState("");
  const [dlPending, startDl] = useTransition();
  const [dlErr, setDlErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return groups;
    return groups
      .map((g) => ({
        ...g,
        teachers: g.teachers.filter(
          (r) => r.name.toLowerCase().includes(s) || r.username.toLowerCase().includes(s),
        ),
      }))
      .filter((g) => g.teachers.length > 0);
  }, [groups, q]);

  function download() {
    setDlErr(null);
    startDl(async () => {
      const r = await getTeacherPayrollReport();
      if (!r.ok) { setDlErr(r.error); return; }
      buildTeacherPayrollXlsx(r.data);
    });
  }

  return (
    <div className="space-y-5">
      {/* 대시보드 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="강사 수" value={String(dashboard.teacherCount)} />
        <Stat
          label="평균 만족도"
          value={dashboard.avgSatisfaction != null ? `${dashboard.avgSatisfaction}/10` : "—"}
          sub={dashboard.ratingCount > 0 ? `${dashboard.ratingCount}건` : "평가 없음"}
          highlight
        />
        <Stat label="운영 과정" value={String(dashboard.totalCourses)} />
        <Stat label="누적 진행 수업" value={String(dashboard.totalClasses)} />
      </section>

      {/* 검색 + 다운로드 */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input flex-1"
          placeholder="강사 이름 / 아이디 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn whitespace-nowrap" disabled={dlPending} onClick={download}>
          {dlPending ? "생성 중..." : "강사 정산 엑셀"}
        </button>
      </div>
      {dlErr && <p className="text-xs text-red-600">{dlErr}</p>}
      <p className="-mt-3 text-xs text-slate-400">
        엑셀: [종합] 강사별 합산 정산액 + 기업별 시트(강좌별 강사 정보·페이롤). 파일명·문서 상단에 다운로드 날짜 기재.
      </p>

      {/* 과정별 그룹 */}
      {filtered.length === 0 ? (
        <div className="card text-center text-sm text-slate-400">검색 결과 없음</div>
      ) : (
        filtered.map((g) => (
          <section key={g.key} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <header className="border-b border-slate-100 bg-gradient-to-r from-brand-50 to-white px-4 py-3">
              <h3 className="flex flex-wrap items-center font-semibold text-brand-900">
                {g.title === "미배정 강사" ? "미배정 강사" : `${g.title}`}
                {g.company && <span className="ml-2 text-sm font-normal text-slate-500">· {g.company}</span>}
                <span className="ml-2 text-xs font-normal text-slate-400">강사 {g.teachers.length}명</span>
                {g.key !== "__unassigned__" && (
                  <span className="ml-auto"><CourseEvalButton courseId={g.key} /></span>
                )}
              </h3>
            </header>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">강사</th>
                  <th className="px-4 py-2 text-right">만족도</th>
                  <th className="px-4 py-2 text-right">담당 과정</th>
                  <th className="px-4 py-2 text-right">진행 수업</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {g.teachers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">{t.name}</span>
                      <span className="ml-2 text-xs text-slate-400">@{t.username}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.ratingAvg != null ? (
                        <span className="font-semibold text-amber-700">
                          {t.ratingAvg}
                          <span className="ml-1 text-xs font-normal text-slate-400">({t.ratingCount})</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{t.courses}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{t.classes}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/teachers/${t.id}`}
                        className="rounded-md border border-brand-300 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
                        상세 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// 강좌별 강사평가 (센터 전용 — 실명)
// ---------------------------------------------------------------------
type CourseEvalData = Extract<Awaited<ReturnType<typeof getCourseTeacherEvalAdmin>>, { ok: true }>;

function CourseEvalButton({ courseId }: { courseId: string }) {
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<CourseEvalData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function open() {
    setErr(null);
    startTransition(async () => {
      const r = await getCourseTeacherEvalAdmin(courseId);
      if (!r.ok) { setErr(r.error); return; }
      setData(r);
    });
  }

  return (
    <>
      <button type="button" disabled={pending} onClick={open}
        className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100">
        {pending ? "불러오는 중..." : "강사평가"}
      </button>
      {err && <span className="ml-2 text-xs font-normal text-red-600">{err}</span>}
      {data && <CourseEvalModal data={data} onClose={() => setData(null)} />}
    </>
  );
}

function CourseEvalModal({ data, onClose }: { data: CourseEvalData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <header className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold text-slate-800">
            강사평가 — {data.courseName}
            {data.courseCode && <span className="ml-2 font-mono text-xs font-normal text-slate-400">{data.courseCode}</span>}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            이 강좌의 교육생이 강사에게 남긴 평가(1~10점)입니다. 센터 전용 화면으로, 강사에게는 익명 취합만 전달됩니다.
          </p>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {data.teachers.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">배정된 강사가 없습니다.</p>
          )}
          {data.teachers.map((t) => (
            <section key={t.teacher_id} className="rounded-lg border border-slate-200">
              <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
                <span className="text-sm font-bold text-slate-800">{t.teacher_name} 강사</span>
                <span className="text-xs text-slate-500">
                  평가 {t.count}건{t.avg != null && <> · 평균 <b className="text-amber-700">{t.avg}</b>/10</>}
                </span>
              </header>
              {t.items.length === 0 ? (
                <p className="px-4 py-3 text-center text-xs text-slate-400">아직 평가가 없습니다.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-1.5">교육생</th>
                      <th className="px-2 py-1.5">점수</th>
                      <th className="px-2 py-1.5">코멘트</th>
                      <th className="px-4 py-1.5 text-right">수정일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {t.items.map((x, i) => (
                      <tr key={i} className="align-top">
                        <td className="whitespace-nowrap px-4 py-2 font-medium text-slate-800">{x.student_name}</td>
                        <td className="px-2 py-2 font-bold text-amber-700">{x.rating ?? "—"}</td>
                        <td className="px-2 py-2 text-slate-600">{x.comment || <span className="text-slate-300">—</span>}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-right text-xs text-slate-400">
                          {new Date(x.date).toLocaleDateString("ko-KR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ))}
        </div>
        <footer className="flex justify-end border-t border-slate-100 px-5 py-3">
          <button className="btn-ghost" onClick={onClose}>닫기</button>
        </footer>
      </div>
    </div>
  );
}

function Stat({
  label, value, sub, highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={"rounded-lg p-3 " + (highlight ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-700")}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      {sub && <div className="text-[11px] opacity-60">{sub}</div>}
    </div>
  );
}
