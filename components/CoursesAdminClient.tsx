"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCourse,
  assignCourseTeachers,
  removeCourseTeacher,
  replaceCourseTeacher,
  getCourseNameReport,
} from "@/lib/actions/course";
import { buildCourseNameXlsx } from "@/lib/reportXlsx";

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
  start_date: string | null;
  end_date: string | null;
  weekdays: string[];
  class_time: string | null;
  duration_min: number | null;
  total_sessions: number | null;
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
const TYPE: Record<string, string> = { "1on1": "1:1", small_group: "소그룹" };

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
  const [assignFor, setAssignFor] = useState<CourseRow | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "닫기" : "+ 새 과정 만들기"}
        </button>
      </div>

      {showCreate && <CreateForm onDone={() => setShowCreate(false)} />}

      {courses.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">
          아직 생성된 과정이 없습니다. “+ 새 과정 만들기”로 시작하세요.
        </div>
      ) : (
        <div className="space-y-4">
          {(() => {
            const byName = new Map<string, CourseRow[]>();
            for (const c of courses)
              (byName.get(c.name) ?? byName.set(c.name, []).get(c.name)!).push(c);
            return Array.from(byName.entries()).map(([name, list]) => {
              const totalStudents = list.reduce((s, c) => s + (studentCounts[c.id] ?? 0), 0);
              return (
                <section key={name} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <header className="border-b border-slate-100 bg-gradient-to-r from-brand-50 to-white px-4 py-3">
                    <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-brand-900">
                      📘 {name}
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                        기업 {list.length}곳
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                        총 교육생 {totalStudents}명
                      </span>
                      <span className="ml-auto"><CourseNameDownload name={name} /></span>
                    </h3>
                  </header>
                  <div className="divide-y divide-slate-100">
                    {list.map((c) => (
                      <CourseCard
                        key={c.id}
                        course={c}
                        teachers={assignments[c.id] ?? []}
                        studentCount={studentCounts[c.id] ?? 0}
                        onAssign={() => setAssignFor(c)}
                      />
                    ))}
                  </div>
                </section>
              );
            });
          })()}
        </div>
      )}

      {assignFor && (
        <TeacherAssignModal
          course={assignFor}
          allTeachers={allTeachers}
          assigned={assignments[assignFor.id] ?? []}
          onClose={() => setAssignFor(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
function CreateForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    code: "", name: "", company_name: "", language: "", textbook: "",
    format: "", class_type: "", capacity: "",
    start_date: "", end_date: "", class_time: "", duration_min: "60", total_sessions: "",
  });
  const [weekdays, setWeekdays] = useState<string[]>([]);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const toggleDay = (d: string) =>
    setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]));

  function submit() {
    setErr(null);
    if (!f.name.trim()) return setErr("강좌명은 필수입니다.");
    startTransition(async () => {
      const r = await createCourse({
        code: f.code, name: f.name, company_name: f.company_name, language: f.language, textbook: f.textbook,
        format: (f.format || null) as any, class_type: (f.class_type || null) as any,
        capacity: f.capacity ? Number(f.capacity) : null,
        start_date: f.start_date || null, end_date: f.end_date || null,
        weekdays, class_time: f.class_time || null,
        duration_min: f.duration_min ? Number(f.duration_min) : null,
        total_sessions: f.total_sessions ? Number(f.total_sessions) : null,
      });
      if (!r.ok) { setErr(r.error); return; }
      router.refresh();
      onDone();
    });
  }

  return (
    <section className="card space-y-4">
      <h2 className="text-base font-semibold">새 과정</h2>
      {err && <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="강좌코드"><input className="input" value={f.code} onChange={(e) => set("code", e.target.value)} placeholder="비워두면 자동 생성 (예: AF-EN-2601)" /></Field>
        <Field label="강좌명 *"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Topical Conversations in the Workplace" /></Field>
        <Field label="회사"><input className="input" value={f.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="Afinit" /></Field>
        <Field label="언어"><input className="input" value={f.language} onChange={(e) => set("language", e.target.value)} placeholder="English" /></Field>
        <Field label="교재명"><input className="input" value={f.textbook} onChange={(e) => set("textbook", e.target.value)} placeholder="예: Market Leader Intermediate" /></Field>
        <Field label="진행 방식">
          <select className="input" value={f.format} onChange={(e) => set("format", e.target.value)}>
            <option value="">선택</option><option value="online">온라인</option><option value="offline">오프라인</option>
          </select>
        </Field>
        <Field label="수업 형태">
          <select className="input" value={f.class_type} onChange={(e) => set("class_type", e.target.value)}>
            <option value="">선택</option><option value="1on1">1:1</option><option value="small_group">소그룹</option>
          </select>
        </Field>
        <Field label="정원"><input type="number" className="input" value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field>
        <Field label="총 차시"><input type="number" className="input" value={f.total_sessions} onChange={(e) => set("total_sessions", e.target.value)} /></Field>
        <Field label="시작일"><input type="date" className="input" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
        <Field label="종료일"><input type="date" className="input" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} /></Field>
        <Field label="시작 시각 (HH:mm)"><input type="time" className="input" value={f.class_time} onChange={(e) => set("class_time", e.target.value)} /></Field>
        <Field label="수업 길이(분)"><input type="number" className="input" value={f.duration_min} onChange={(e) => set("duration_min", e.target.value)} /></Field>
      </div>
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
        {pending ? "생성 중..." : "과정 생성"}
      </button>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label className="label">{label}</label>{children}</div>);
}

// ---------------------------------------------------------------------
function CourseCard({
  course, teachers, studentCount, onAssign,
}: {
  course: CourseRow;
  teachers: Assigned[];
  studentCount: number;
  onAssign: () => void;
}) {
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
            <h4 className="text-base font-bold text-slate-800">🏢 {course.company_name ?? "(회사 미지정)"}</h4>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
              👥 {studentCount}명
            </span>
            {course.code && <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">{course.code}</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            {course.language && <span>🗣 {course.language}</span>}
            {course.textbook && <span>📖 {course.textbook}</span>}
            {course.class_type && <span>{TYPE[course.class_type] ?? course.class_type}</span>}
            {course.format && <span>{FMT[course.format] ?? course.format}</span>}
            {course.capacity != null && <span>정원 {course.capacity}</span>}
            <span>기간 {period}</span>
            <span>요일 {days}</span>
            {course.class_time && <span>{course.class_time}{course.duration_min ? ` · ${course.duration_min}분` : ""}</span>}
          </div>
        </div>
        <button className="btn-ghost shrink-0 !border !border-slate-300 text-sm" onClick={onAssign}>
          👤 강사 배정
        </button>
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
function TeacherAssignModal({
  course, allTeachers, assigned, onClose,
}: {
  course: CourseRow;
  allTeachers: TeacherOption[];
  assigned: Assigned[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [replacing, setReplacing] = useState<Assigned | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const assignedIds = useMemo(() => new Set(assigned.map((a) => a.teacher_id)), [assigned]);
  // 강사들이 등록한 사용 언어 목록 (쉼표 구분 → distinct)
  const allLangs = useMemo(() => {
    const set = new Set<string>();
    for (const t of allTeachers)
      for (const l of (t.languages ?? "").split(/[,/·]+/))
        if (l.trim()) set.add(l.trim());
    return Array.from(set).sort();
  }, [allTeachers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTeachers.filter((t) => {
      const langs = (t.languages ?? "").toLowerCase();
      if (langFilter !== "all" && !langs.includes(langFilter.toLowerCase())) return false;
      return !q
        || t.name.toLowerCase().includes(q)
        || t.username.toLowerCase().includes(q)
        || langs.includes(q);
    });
  }, [allTeachers, search, langFilter]);

  function refresh() { router.refresh(); }

  function doAssign() {
    if (selected.size === 0) return;
    startTransition(async () => {
      const r = await assignCourseTeachers(course.id, [...selected]);
      if (!r.ok) { setMsg(r.error); return; }
      setSelected(new Set());
      setMsg("배정되었습니다.");
      refresh();
    });
  }
  function doRemove(tid: string) {
    startTransition(async () => {
      const r = await removeCourseTeacher(course.id, tid);
      if (!r.ok) { setMsg(r.error); return; }
      refresh();
    });
  }
  function doReplace(newId: string) {
    if (!replacing) return;
    startTransition(async () => {
      const r = await replaceCourseTeacher(course.id, replacing.teacher_id, newId);
      if (!r.ok) { setMsg(r.error); return; }
      setReplacing(null);
      setMsg("교체되었습니다. (과거 데이터 유지 · 이후 슬롯은 새 강사로)");
      refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-slate-800">강사 배정 — {course.name}</h3>
        {msg && <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">{msg}</p>}

        {/* 현재 배정 강사 */}
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-slate-500">현재 배정 강사</p>
          {assigned.length === 0 ? (
            <p className="text-xs text-slate-400">없음</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {assigned.map((a) => (
                <span key={a.teacher_id} className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 py-0.5 pl-2.5 pr-1 text-xs text-brand-700">
                  {a.name}
                  <button className="rounded px-1 text-brand-400 hover:bg-brand-100 hover:text-brand-700" title="교체"
                    onClick={() => setReplacing(replacing?.teacher_id === a.teacher_id ? null : a)}>↔</button>
                  <button className="rounded px-1 text-red-400 hover:bg-red-50 hover:text-red-600" title="해제"
                    disabled={pending} onClick={() => doRemove(a.teacher_id)}>✕</button>
                </span>
              ))}
            </div>
          )}
          {replacing && (
            <p className="mt-1 text-xs text-amber-700">
              <b>{replacing.name}</b> 를 교체할 강사를 아래에서 선택하세요.
            </p>
          )}
        </div>

        {/* 언어 필터 */}
        {allLangs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setLangFilter("all")}
              className={"rounded-full px-2.5 py-1 text-xs font-medium transition " +
                (langFilter === "all" ? "bg-brand-600 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50")}>
              전체 언어
            </button>
            {allLangs.map((l) => (
              <button key={l} type="button" onClick={() => setLangFilter(langFilter === l ? "all" : l)}
                className={"rounded-full px-2.5 py-1 text-xs font-medium transition " +
                  (langFilter === l ? "bg-brand-600 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50")}>
                🗣 {l}
              </button>
            ))}
          </div>
        )}

        {/* 검색 */}
        <input className="input mt-2" placeholder="강사 이름/아이디/언어 검색"
          value={search} onChange={(e) => setSearch(e.target.value)} />

        {/* 강사 리스트 */}
        <div className="mt-2 flex-1 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
          {filtered.length === 0 && <p className="p-4 text-center text-xs text-slate-400">검색 결과 없음</p>}
          {filtered.map((t) => {
            const isAssigned = assignedIds.has(t.id);
            const isSelected = selected.has(t.id);
            return (
              <div key={t.id} className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-slate-800">{t.name}</span>
                  <span className="ml-2 text-xs text-slate-400">@{t.username}</span>
                  {t.languages && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">🗣 {t.languages}</span>
                  )}
                  {isAssigned && <span className="ml-2 text-[10px] text-brand-600">배정됨</span>}
                </div>
                {replacing ? (
                  t.id !== replacing.teacher_id && (
                    <button className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600"
                      disabled={pending} onClick={() => doReplace(t.id)}>
                      이 강사로 교체
                    </button>
                  )
                ) : isAssigned ? (
                  <span className="text-xs text-slate-300">—</span>
                ) : (
                  <button
                    className={"rounded-md px-2.5 py-1 text-xs font-semibold transition " +
                      (isSelected ? "bg-brand-600 text-white" : "border border-brand-300 text-brand-700 hover:bg-brand-50")}
                    onClick={() =>
                      setSelected((s) => {
                        const n = new Set(s);
                        n.has(t.id) ? n.delete(t.id) : n.add(t.id);
                        return n;
                      })
                    }>
                    {isSelected ? "✓ 선택됨" : "Select"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">{selected.size > 0 ? `${selected.size}명 선택됨` : "여러 명 선택 가능 · 제한 없음"}</span>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose}>닫기</button>
            <button className="btn" disabled={pending || selected.size === 0} onClick={doAssign}>
              {pending ? "처리 중..." : `배정 (${selected.size})`}
            </button>
          </div>
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
        {pending ? "생성 중..." : "📊 과정 데이터"}
      </button>
      {err && <span className="text-xs font-normal text-red-600">{err}</span>}
    </span>
  );
}
