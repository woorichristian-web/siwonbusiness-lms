"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCourse,
  updateCourse,
  deleteCourse,
  duplicateCourse,
  openCourse,
  assignCourseTeachers,
  removeCourseTeacher,
  getCourseNameReport,
} from "@/lib/actions/course";
import { buildCourseNameXlsx, buildSurveyXlsx, type SurveyXlsxData } from "@/lib/reportXlsx";
import { getCourseSurveyAdmin } from "@/lib/actions/survey";

export interface CourseRow {
  id: string;
  code: string | null;
  name: string;
  company_name: string | null;
  language: string | null;
  textbook: string | null;
  format: string | null;
  class_type: string | null;
  capacity: number | null;
  class_count: number | null;
  start_date: string | null;
  end_date: string | null;
  weekdays: string[];
  class_time: string | null;
  duration_min: number | null;
  total_sessions: number | null;
  is_test?: boolean | null;
}
export interface TeacherOption {
  id: string;
  name: string;
  username: string;
  languages: string | null;
}
type Assigned = { teacher_id: string; name: string };

const WEEKDAYS: [string, string][] = [
  ["mon", "월"], ["tue", "화"], ["wed", "수"], ["thu", "목"],
  ["fri", "금"], ["sat", "토"], ["sun", "일"],
];
const FMT: Record<string, string> = { online: "온라인", offline: "오프라인" };
// 언어 목록 — 상위 4개 고정, 이후 시원스쿨 취급 언어 알파벳순
const LANGUAGES = [
  "English", "Korean", "Japanese", "Chinese",
  "Arabic", "French", "German", "Indonesian", "Italian",
  "Portuguese", "Russian", "Spanish", "Thai", "Vietnamese",
];
// 사용 중인 교재 목록 — 새 교재는 '직접 입력'으로 추가
const TEXTBOOKS = [
  "Topical Conversations in the Workplace",
  "Functional Communication for Meetings in the Workplace",
  "Functional Communication for Presentations in the Workplace",
];
const TYPE: Record<string, string> = {
  "1on1": "1:1 수업",
  "1on1_coaching": "1:1 Coaching",
  group: "Group 수업",
  group_coaching: "Group Coaching",
  small_group: "Group 수업",
};

export default function CoursesAdminClient({
  courses,
  allTeachers,
  assignments,
  studentCounts = {},
}: {
  courses: CourseRow[];
  allTeachers: TeacherOption[];
  assignments: Record<string, Assigned[]>;
  studentCounts?: Record<string, number>;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editFor, setEditFor] = useState<CourseRow | null>(null);

  // 과정명 그룹 단위 페이지네이션 — 페이지당 5개 그룹
  const PER_PAGE = 5;
  const [page, setPage] = useState(1);
  const groups = useMemo(() => {
    const byName = new Map<string, CourseRow[]>();
    for (const c of courses)
      (byName.get(c.name) ?? byName.set(c.name, []).get(c.name)!).push(c);
    return Array.from(byName.entries());
  }, [courses]);
  const totalPages = Math.max(1, Math.ceil(groups.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const visibleGroups = groups.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "닫기" : "+ 새 과정 만들기"}
        </button>
      </div>

      {showCreate && (
        <CreateForm onDone={() => setShowCreate(false)} allTeachers={allTeachers} assignedIds={[]} />
      )}

      {courses.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">
          아직 생성된 과정이 없습니다. “+ 새 과정 만들기”로 시작하세요.
        </div>
      ) : (
        <div className="space-y-4">
          {visibleGroups.map(([name, list]) => {
            const totalStudents = list.reduce((s, c) => s + (studentCounts[c.id] ?? 0), 0);
            return (
              <section key={name} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <header className="border-b border-slate-100 bg-gradient-to-r from-brand-50 to-white px-4 py-3">
                  <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-brand-900">
                    {name}
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                      기업 {list.length}곳
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                      총 교육생 {totalStudents}명
                    </span>
                    <span className="ml-auto inline-flex items-center gap-2">
                      <SurveyResultsButton courses={list} />
                      <CourseNameDownload name={name} />
                    </span>
                  </h3>
                </header>
                <div className="divide-y divide-slate-100">
                  {list.map((c) => (
                    <CourseCard
                      key={c.id}
                      course={c}
                      teachers={assignments[c.id] ?? []}
                      studentCount={studentCounts[c.id] ?? 0}
                      onEdit={() => setEditFor(c)}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
        </div>
      )}

      {editFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditFor(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CreateForm
              initial={editFor}
              onDone={() => setEditFor(null)}
              allTeachers={allTeachers}
              assignedIds={(assignments[editFor.id] ?? []).map((a) => a.teacher_id)}
            />
          </div>
        </div>
      )}


    </div>
  );
}

// ---------------------------------------------------------------------
// 페이지네이션 — 번호 10개 블록(1~10 → 11~20 …) + 맨 앞/맨 뒤 건너뛰기
// ---------------------------------------------------------------------
function Pagination({
  page, totalPages, onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const BLOCK = 10;
  const blockStart = Math.floor((page - 1) / BLOCK) * BLOCK + 1;
  const blockEnd = Math.min(blockStart + BLOCK - 1, totalPages);
  const nums = [];
  for (let p = blockStart; p <= blockEnd; p++) nums.push(p);

  const btn = "inline-flex h-8 min-w-[32px] items-center justify-center rounded-md border px-2 text-sm transition";
  const idle = " border-slate-300 bg-white text-slate-600 hover:border-brand-400 hover:text-brand-700";
  const active = " border-brand-600 bg-brand-600 font-bold text-white";
  const nav = btn + " border-slate-300 bg-white text-slate-500 hover:border-brand-400 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5 pt-2" aria-label="페이지 이동">
      <button type="button" className={nav} disabled={page === 1}
        onClick={() => onChange(1)} title="맨 앞으로">«</button>
      <button type="button" className={nav} disabled={blockStart === 1}
        onClick={() => onChange(blockStart - 1)} title="이전 10페이지">‹</button>
      {nums.map((p) => (
        <button key={p} type="button"
          className={btn + (p === page ? active : idle)}
          onClick={() => onChange(p)}>
          {p}
        </button>
      ))}
      <button type="button" className={nav} disabled={blockEnd === totalPages}
        onClick={() => onChange(blockEnd + 1)} title="다음 10페이지">›</button>
      <button type="button" className={nav} disabled={page === totalPages}
        onClick={() => onChange(totalPages)} title="맨 뒤로">»</button>
      <span className="ml-2 text-xs text-slate-400">{page} / {totalPages} 페이지</span>
    </nav>
  );
}

// ---------------------------------------------------------------------
function CreateForm({
  onDone, initial, allTeachers, assignedIds,
}: {
  onDone: () => void;
  initial?: CourseRow | null;
  allTeachers: TeacherOption[];
  assignedIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    company_name: initial?.company_name ?? "",
    language: initial?.language ?? "",
    textbook: initial?.textbook ?? "",
    format: initial?.format ?? "",
    class_type: initial?.class_type ?? "",
    capacity: initial?.capacity != null ? String(initial.capacity) : "",
    class_count: initial?.class_count != null ? String(initial.class_count) : "",
    start_date: initial?.start_date ?? "",
    end_date: initial?.end_date ?? "",
    class_time: initial?.class_time ?? "",
    duration_min: initial?.duration_min != null ? String(initial.duration_min) : "60",
    total_sessions: initial?.total_sessions != null ? String(initial.total_sessions) : "",
  });
  const [weekdays, setWeekdays] = useState<string[]>(initial?.weekdays ?? []);
  // 새 과정은 기본 테스트(센터 전용)로 생성 — [과정 오픈]을 눌러야 공개된다
  const [isTest, setIsTest] = useState<boolean>(initial ? !!initial.is_test : true);
  const [customBook, setCustomBook] = useState(
    !!(initial?.textbook && !TEXTBOOKS.includes(initial.textbook)),
  );
  const [selTeachers, setSelTeachers] = useState<string[]>(assignedIds);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customLang, setCustomLang] = useState(
    !!(initial?.language && !LANGUAGES.includes(initial.language)),
  );
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const toggleDay = (d: string) =>
    setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]));

  function submit() {
    setErr(null);
    if (!f.name.trim()) return setErr("강좌명은 필수입니다.");
    startTransition(async () => {
      const payload = {
        code: f.code, name: f.name, company_name: f.company_name, language: f.language, textbook: f.textbook,
        format: (f.format || null) as any, class_type: (f.class_type || null) as any,
        capacity: f.capacity ? Number(f.capacity) : null,
        class_count: f.class_count ? Number(f.class_count) : null,
        start_date: f.start_date || null, end_date: f.end_date || null,
        weekdays, class_time: f.class_time || null,
        duration_min: f.duration_min ? Number(f.duration_min) : null,
        total_sessions: f.total_sessions ? Number(f.total_sessions) : null,
        is_test: isTest,
      };
      const r = initial
        ? await updateCourse(initial.id, payload)
        : await createCourse(payload);
      if (!r.ok) { setErr(r.error); return; }
      // 강사 배정 동기화 (추가/해제)
      const courseId = initial ? initial.id : (r as any).courseId as string;
      const before = new Set(assignedIds);
      const after = new Set(selTeachers);
      const toAdd = selTeachers.filter((id) => !before.has(id));
      const toRemove = assignedIds.filter((id) => !after.has(id));
      if (toAdd.length > 0) await assignCourseTeachers(courseId, toAdd);
      for (const id of toRemove) await removeCourseTeacher(courseId, id);
      router.refresh();
      onDone();
    });
  }

  return (
    <section className="card space-y-4">
      <h2 className="text-base font-semibold">{initial ? `과정 수정 — ${initial.name}` : "새 과정"}</h2>
      {err && <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="강좌코드"><input className="input" value={f.code} onChange={(e) => set("code", e.target.value)} placeholder="비워두면 자동 생성 (예: AF-EN-BEC-2601)" /></Field>
        <Field label="강좌명 *"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Topical Conversations in the Workplace" /></Field>
        <Field label="회사"><input className="input" value={f.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="Afinit" /></Field>
        <Field label="언어">
          <select
            className="input"
            value={customLang ? "__custom__" : (f.language || "")}
            onChange={(e) => {
              if (e.target.value === "__custom__") { setCustomLang(true); set("language", ""); }
              else { setCustomLang(false); set("language", e.target.value); }
            }}
          >
            <option value="">선택 안 함</option>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
            <option value="__custom__">직접 입력…</option>
          </select>
          {customLang && (
            <input className="input mt-1.5" autoFocus placeholder="언어 직접 입력"
              value={f.language} onChange={(e) => set("language", e.target.value)} />
          )}
        </Field>
        <Field label="교재명">
          <select
            className="input"
            value={customBook ? "__custom__" : (f.textbook || "")}
            onChange={(e) => {
              if (e.target.value === "__custom__") { setCustomBook(true); set("textbook", ""); }
              else { setCustomBook(false); set("textbook", e.target.value); }
            }}
          >
            <option value="">선택 안 함</option>
            {TEXTBOOKS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
            <option value="__custom__">직접 입력…</option>
          </select>
          {customBook && (
            <input className="input mt-1.5" autoFocus placeholder="새 교재명 입력"
              value={f.textbook} onChange={(e) => set("textbook", e.target.value)} />
          )}
        </Field>
        <Field label="진행 방식">
          <select className="input" value={f.format} onChange={(e) => set("format", e.target.value)}>
            <option value="">선택</option><option value="online">온라인</option><option value="offline">오프라인</option>
          </select>
        </Field>
        <Field label="수업 형태">
          <select className="input" value={f.class_type} onChange={(e) => set("class_type", e.target.value)}>
            <option value="">선택</option>
            <option value="1on1">1:1 수업</option>
            <option value="1on1_coaching">1:1 Coaching</option>
            <option value="group">Group 수업</option>
            <option value="group_coaching">Group Coaching</option>
          </select>
        </Field>
        <Field label="정원"><input type="number" className="input" value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field>
        <Field label="총 차시"><input type="number" className="input" value={f.total_sessions} onChange={(e) => set("total_sessions", e.target.value)} /></Field>
        <Field label="시작일"><input type="date" className="input" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
        <Field label="종료일"><input type="date" className="input" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} /></Field>
        <Field label="시작 시각 (HH:mm)"><input type="time" className="input" value={f.class_time} onChange={(e) => set("class_time", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="수업 길이(분)"><input type="number" className="input" value={f.duration_min} onChange={(e) => set("duration_min", e.target.value)} /></Field>
          <Field label="클래스 수"><input type="number" min={1} className="input" value={f.class_count} onChange={(e) => set("class_count", e.target.value)} placeholder="예: 3" /></Field>
        </div>
        <Field label={`강사 배정 (${selTeachers.length}${f.class_count ? ` / ${f.class_count}` : ""}명)`}>
          <div className="space-y-2 rounded-md border border-slate-200 p-2.5">
            {selTeachers.length === 0 ? (
              <p className="text-xs text-slate-400">배정된 강사가 없습니다. 클래스 수만큼 강사를 배정하세요.</p>
            ) : (
              <ul className="space-y-1">
                {selTeachers.map((id, i) => {
                  const t = allTeachers.find((x) => x.id === id);
                  return (
                    <li key={id} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1 text-sm">
                      <span className="w-14 shrink-0 text-[11px] font-medium text-slate-400">Class {i + 1}</span>
                      <span className="font-medium text-slate-800">{t?.name ?? "(알 수 없음)"}</span>
                      {t && <span className="text-xs text-slate-400">@{t.username}</span>}
                      {t?.languages && <span className="ml-auto text-[11px] text-slate-400">{t.languages}</span>}
                      <button type="button" title="배정 해제"
                        className="rounded px-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        onClick={() => setSelTeachers((s) => s.filter((x) => x !== id))}>
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {(() => {
              const limit = f.class_count ? Number(f.class_count) : null;
              const full = limit != null && selTeachers.length >= limit;
              return (
                <div className="flex items-center gap-2">
                  <button type="button" disabled={full}
                    className="rounded-md border border-brand-300 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => setPickerOpen(true)}>
                    {selTeachers.length === 0 ? "강사 배정" : "추가 배정"}
                  </button>
                  {full && <span className="text-[11px] text-slate-400">클래스 수({limit})만큼 배정이 완료되었습니다.</span>}
                </div>
              );
            })()}
          </div>
          {pickerOpen && (
            <TeacherPickerModal
              allTeachers={allTeachers}
              excludeIds={selTeachers}
              onPick={(id) => { setSelTeachers((s) => [...s, id]); setPickerOpen(false); }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </Field>
      </div>
      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-amber-200 bg-amber-50/50 p-2.5">
        <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300"
          checked={isTest} onChange={(e) => setIsTest(e.target.checked)} />
        <span className="text-sm">
          <b className="text-amber-800">Test course (테스트 과정)</b>
          <span className="mt-0.5 block text-xs text-slate-500">
            체크 시 센터에서만 보이는 테스트용 과정으로 생성됩니다. 강사·교육생을 배정해도
            그들의 화면(일정·수강현황·대화방·설문 등) 어디에도 노출되지 않습니다.
          </span>
        </span>
      </label>
      <Field label="수업 요일">
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map(([d, ko]) => (
            <button key={d} type="button" onClick={() => toggleDay(d)}
              className={"h-9 w-9 rounded-md border text-sm font-medium transition " +
                (weekdays.includes(d) ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 bg-white text-slate-500 hover:border-brand-400")}>
              {ko}
            </button>
          ))}
        </div>
      </Field>
      <button className="btn w-full" disabled={pending} onClick={submit}>
        {pending ? "저장 중..." : initial ? "수정 저장" : "과정 생성"}
      </button>
      {initial && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm("정말 삭제하시겠습니까? 삭제하면 복원되지 않습니다.")) return;
            startTransition(async () => {
              const r = await deleteCourse(initial.id);
              if (!r.ok) { setErr(r.error); return; }
              router.refresh();
              onDone();
            });
          }}
          className="w-full rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
        >
          과정 삭제
        </button>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label className="label">{label}</label>{children}</div>);
}

// ---------------------------------------------------------------------
function CourseCard({
  course, teachers, studentCount, onEdit,
}: {
  course: CourseRow;
  teachers: Assigned[];
  studentCount: number;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [actionPending, startAction] = useTransition();
  const period =
    course.start_date || course.end_date
      ? `${course.start_date ?? "?"} ~ ${course.end_date ?? "?"}`
      : "—";
  const days = course.weekdays?.length
    ? course.weekdays.map((d) => WEEKDAYS.find(([k]) => k === d)?.[1] ?? d).join("·")
    : "—";
  return (
    <section className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-bold text-slate-800">{course.company_name ?? "(회사 미지정)"}</h4>
            {course.is_test && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800" title="센터에서만 보이는 테스트 과정">
                TEST
              </span>
            )}
            <span className="rounded-full bg-brand-50 px-3 py-0.5 text-sm font-bold text-brand-700">
              교육생 {studentCount}명
            </span>
            {course.code && <span className="rounded bg-slate-100 px-2.5 py-0.5 font-mono text-sm text-slate-500">{course.code}</span>}
          </div>
          <p className="mt-1.5 text-base font-semibold text-brand-800">{course.name}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            {course.language && <span>{course.language}</span>}
            {course.textbook && <span>교재 {course.textbook}</span>}
            {course.class_type && <span>{TYPE[course.class_type] ?? course.class_type}</span>}
            {course.format && <span>{FMT[course.format] ?? course.format}</span>}
            {course.capacity != null && <span>정원 {course.capacity}</span>}
            <span>기간 {period}</span>
            <span>요일 {days}</span>
            {course.class_time && <span>{course.class_time}{course.duration_min ? ` · ${course.duration_min}분` : ""}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button className="btn-ghost !border !border-slate-300 text-sm" onClick={onEdit}>
            수정
          </button>
          <button
            className="btn-ghost !border !border-slate-300 text-sm"
            disabled={actionPending}
            onClick={() => {
              if (!confirm(`"${course.name}" 과정을 복사할까요?\n교육생·강사·커리큘럼이 그대로 복제되고, 테스트 과정으로 만들어집니다.`)) return;
              startAction(async () => {
                const r = await duplicateCourse(course.id);
                if (!r.ok) { alert(r.error); return; }
                router.refresh();
              });
            }}
          >
            {actionPending ? "..." : "과정 복사"}
          </button>
          {course.is_test && (
            <button
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              disabled={actionPending}
              onClick={() => {
                if (!confirm(`"${course.name}" 과정을 오픈할까요?\n오픈하면 배정된 강사·교육생에게 공개되고 실제 사용이 시작됩니다.`)) return;
                startAction(async () => {
                  const r = await openCourse(course.id);
                  if (!r.ok) { alert(r.error); return; }
                  router.refresh();
                });
              }}
            >
              과정 오픈
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-slate-500">배정 강사:</span>
        {teachers.length === 0 ? (
          <span className="text-xs text-slate-400">아직 없음</span>
        ) : (
          teachers.map((t) => (
            <span key={t.teacher_id} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
              {t.name}
            </span>
          ))
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// 설문 결과 (센터 전용 — 실명 열람)
// ---------------------------------------------------------------------
type SurveyRoundData = SurveyXlsxData["rounds"][number];

function SurveyResultsButton({ courses }: { courses: CourseRow[] }) {
  const [pending, startTransition] = useTransition();
  const [dataList, setDataList] = useState<SurveyXlsxData[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function open() {
    setErr(null);
    startTransition(async () => {
      const results = await Promise.all(courses.map((c) => getCourseSurveyAdmin(c.id)));
      const bad = results.find((r) => !r.ok);
      if (bad && !bad.ok) { setErr(bad.error); return; }
      setDataList(
        results.filter((r): r is Extract<typeof r, { ok: true }> => r.ok).map((r) => ({
          courseName: r.courseName, courseCode: r.courseCode, companyName: r.companyName,
          author: r.author, generatedAt: r.generatedAt, rounds: r.rounds,
        })),
      );
    });
  }

  return (
    <>
      <button type="button" className="btn-ghost !border !border-slate-300 text-sm font-semibold" disabled={pending} onClick={open}>
        {pending ? "불러오는 중..." : "설문 결과"}
      </button>
      {err && <span className="self-center text-xs font-normal text-red-600">{err}</span>}
      {dataList && <SurveyResultsModal dataList={dataList} onClose={() => setDataList(null)} />}
    </>
  );
}

function fmtD(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric" });
}

function SurveyResultsModal({
  dataList, onClose,
}: {
  dataList: SurveyXlsxData[];
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const data = dataList[Math.min(idx, dataList.length - 1)];
  const now = Date.now();
  // 라운드 안에서 강사별 그룹 (여러 강사가 가르치는 과정 대비)
  function groupByTeacher(responses: SurveyRoundData["responses"]) {
    const m = new Map<string, { name: string; items: SurveyRoundData["responses"] }>();
    for (const x of responses) {
      const key = x.teacher_id ?? "none";
      if (!m.has(key)) m.set(key, { name: x.teacher_name, items: [] });
      m.get(key)!.items.push(x);
    }
    return Array.from(m.values()).map((g) => ({
      ...g,
      avg: Math.round((g.items.reduce((s, v) => s + v.rating, 0) / g.items.length) * 10) / 10,
    }));
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold text-slate-800">만족도 설문 결과 — {data.courseName}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            센터 전용 화면입니다. 강사에게는 익명 취합본만 전달되지만, 여기서는 응답자 실명과 개별 점수·코멘트를 모두 확인할 수 있습니다.
          </p>
          {dataList.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dataList.map((d, i) => (
                <button key={i} type="button" onClick={() => setIdx(i)}
                  className={"rounded-full px-2.5 py-1 text-xs font-medium transition " +
                    (i === idx ? "bg-brand-600 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50")}>
                  {d.companyName ?? d.courseName}
                </button>
              ))}
            </div>
          )}
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {data.rounds.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">과정 기간이 설정되지 않아 설문 라운드가 없습니다.</p>
          )}
          {data.rounds.map((r) => {
            const openT = new Date(r.open).getTime(), closeT = new Date(r.close).getTime();
            const status = now < openT ? "예정" : now < closeT ? "진행 중" : "마감";
            const statusCls =
              status === "진행 중" ? "bg-emerald-50 text-emerald-700" :
              status === "마감" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700";
            return (
              <section key={r.round} className="rounded-lg border border-slate-200">
                <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
                  <span className="text-sm font-bold text-slate-800">{r.round}차 설문 ({r.label})</span>
                  <span className={"rounded-full px-2 py-0.5 text-[11px] font-semibold " + statusCls}>{status}</span>
                  <span className="text-xs text-slate-500">{fmtD(r.open)} ~ {fmtD(r.close)}</span>
                  <span className="ml-auto text-xs text-slate-500">
                    응답 {r.responses.length}건{r.avg != null && <> · 평균 <b className="text-slate-800">{r.avg}</b>/10</>}
                  </span>
                </header>
                {r.responses.length === 0 ? (
                  <p className="px-4 py-3 text-center text-xs text-slate-400">아직 응답이 없습니다.</p>
                ) : (
                  groupByTeacher(r.responses).map((g, gi) => (
                    <div key={gi}>
                      <div className="flex items-center gap-2 border-b border-slate-100 bg-brand-50/50 px-4 py-1.5">
                        <span className="text-xs font-bold text-brand-800">강사 {g.name}</span>
                        <span className="text-[11px] text-slate-500">응답 {g.items.length}건 · 평균 <b>{g.avg}</b>/10</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs uppercase text-slate-400">
                          <tr>
                            <th className="px-4 py-1.5">교육생</th>
                            <th className="px-2 py-1.5">점수</th>
                            <th className="px-2 py-1.5">코멘트</th>
                            <th className="px-4 py-1.5 text-right">제출일</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {g.items.map((x, i) => (
                            <tr key={i} className="align-top">
                              <td className="whitespace-nowrap px-4 py-2">
                                <span className="font-medium text-slate-800">{x.name}</span>
                                {x.username && <span className="ml-1.5 text-xs text-slate-400">@{x.username}</span>}
                              </td>
                              <td className="px-2 py-2 font-bold text-brand-700">{x.rating}</td>
                              <td className="px-2 py-2 text-slate-600">
                                {x.comment ? (
                                  <>
                                    {x.comment}
                                    {x.comment_en && x.comment_en !== x.comment && (
                                      <span className="mt-0.5 block text-xs text-slate-400">EN: {x.comment_en}</span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2 text-right text-xs text-slate-400">{fmtD(x.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
                )}
              </section>
            );
          })}
        </div>
        <footer className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <button className="btn text-sm" onClick={() => buildSurveyXlsx(data)}>
            Excel 다운로드
          </button>
          <button className="btn-ghost" onClick={onClose}>닫기</button>
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
function TeacherPickerModal({
  allTeachers, excludeIds, onPick, onClose,
}: {
  allTeachers: TeacherOption[];
  excludeIds: string[];
  onPick: (teacherId: string) => void;
  onClose: () => void;
}) {
  const [lang, setLang] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // 강사들이 등록한 티칭 언어 목록 (쉼표 구분 → distinct)
  const allLangs = useMemo(() => {
    const set = new Set<string>();
    for (const t of allTeachers)
      for (const l of (t.languages ?? '').split(/[,/·]+/))
        if (l.trim()) set.add(l.trim());
    return Array.from(set).sort();
  }, [allTeachers]);

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  const candidates = useMemo(() => {
    if (!lang) return [];
    const q = search.trim().toLowerCase();
    return allTeachers.filter((t) => {
      if (excluded.has(t.id)) return false;
      const langs = (t.languages ?? '').toLowerCase();
      if (lang !== '__all__' && !langs.includes(lang.toLowerCase())) return false;
      return !q
        || t.name.toLowerCase().includes(q)
        || t.username.toLowerCase().includes(q)
        || langs.includes(q);
    });
  }, [allTeachers, excluded, lang, search]);

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4' onClick={onClose}>
      <div className='flex max-h-[80vh] w-full max-w-md flex-col rounded-lg bg-white p-5 shadow-xl' onClick={(e) => e.stopPropagation()}>
        <h3 className='text-base font-semibold text-slate-800'>강사 배정</h3>

        {/* 1단계 — 언어 선택 */}
        <p className='mt-3 text-xs font-medium text-slate-500'>1. 강사의 티칭 언어를 선택하세요</p>
        <div className='mt-1.5 flex flex-wrap gap-1.5'>
          {allLangs.map((l) => (
            <button key={l} type='button' onClick={() => setLang(l)}
              className={'rounded-full px-3 py-1 text-xs font-medium transition ' +
                (lang === l ? 'bg-brand-600 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50')}>
              {l}
            </button>
          ))}
          <button type='button' onClick={() => setLang('__all__')}
            className={'rounded-full px-3 py-1 text-xs font-medium transition ' +
              (lang === '__all__' ? 'bg-brand-600 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50')}>
            전체
          </button>
          {allLangs.length === 0 && (
            <p className='text-xs text-slate-400'>언어가 등록된 강사가 없습니다. “전체”를 눌러 모든 강사를 확인하세요.</p>
          )}
        </div>

        {/* 2단계 — 후보 검색·선택 */}
        {lang && (
          <>
            <p className='mt-4 text-xs font-medium text-slate-500'>
              2. 강사를 선택하세요
              {lang !== '__all__' && <span className='ml-1 text-slate-400'>({lang} 티칭 가능 강사 {candidates.length}명)</span>}
            </p>
            <input className='input mt-1.5 !py-1.5 text-sm' autoFocus placeholder='이름/아이디 검색'
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className='mt-2 flex-1 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200'>
              {candidates.length === 0 && (
                <p className='p-4 text-center text-xs text-slate-400'>선택 가능한 강사가 없습니다.</p>
              )}
              {candidates.map((t) => (
                <button key={t.id} type='button' onClick={() => onPick(t.id)}
                  className='flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-brand-50'>
                  <span className='text-sm font-medium text-slate-800'>{t.name}</span>
                  <span className='text-xs text-slate-400'>@{t.username}</span>
                  {t.languages && <span className='ml-auto text-[11px] text-slate-400'>{t.languages}</span>}
                </button>
              ))}
            </div>
          </>
        )}

        <div className='mt-4 flex justify-end'>
          <button className='btn-ghost' onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
function CourseNameDownload({ name }: { name: string }) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  function run() {
    setErr(null);
    startTransition(async () => {
      const r = await getCourseNameReport(name);
      if (!r.ok) { setErr(r.error); return; }
      buildCourseNameXlsx(r.data);
    });
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className="btn text-xs" disabled={pending} onClick={run}>
        {pending ? "생성 중..." : "데이터 내려받기"}
      </button>
      {err && <span className="text-xs font-normal text-red-600">{err}</span>}
    </span>
  );
}
