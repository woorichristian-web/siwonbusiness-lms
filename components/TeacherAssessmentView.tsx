"use client";

// 강사용 스피킹 평가(Initial / Final Assessment) 화면.
// 과정 카드 → 교육생 리스트 → 교육생별 평가 에디터(영역 10개 × 1~10점 원형 버튼).
// 모바일 우선: 원형 버튼 10개가 375px 폭에도 한 줄에 들어가도록 크기 조정.
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ASSESSMENT_GROUPS,
  ASSESSMENT_ITEM_KEYS,
  PROFICIENCY_LEVELS,
  proficiencyOf,
  scoreBand,
  scoredCount,
  totalOf,
  type AssessmentPhase,
} from "@/lib/assessment";
import { saveTeacherAssessment } from "@/lib/actions/assessment";
import AssessmentChart from "@/components/AssessmentChart";

type Lang = "en" | "ko";

export interface AssessmentStudent {
  id: string;
  name: string;
  company: string | null;
}

export interface AssessmentRecord {
  scores: Record<string, number>;
  comment: string | null;
}

export interface AssessmentCourseData {
  id: string;
  name: string;
  schedule: string; // 예: "화 09:00 · 60분"
  students: AssessmentStudent[];
  /** studentId → { initial?, final? } */
  records: Record<string, Partial<Record<AssessmentPhase, AssessmentRecord>>>;
}

const BAND_STYLE: Record<string, { idle: string; head: string }> = {
  novice: { idle: "border-amber-300 bg-amber-50 text-amber-700", head: "bg-amber-100 text-amber-800" },
  intermediate: { idle: "border-emerald-300 bg-emerald-50 text-emerald-700", head: "bg-emerald-100 text-emerald-800" },
  advanced: { idle: "border-blue-300 bg-blue-50 text-blue-700", head: "bg-blue-100 text-blue-800" },
  superior: { idle: "border-rose-300 bg-rose-50 text-rose-700", head: "bg-rose-100 text-rose-800" },
};

function t(lang: Lang, ko: string, en: string) {
  return lang === "ko" ? ko : en;
}

export default function TeacherAssessmentView({
  courses,
  lang = "en",
}: {
  courses: AssessmentCourseData[];
  lang?: Lang;
}) {
  const [courseId, setCourseId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ course: AssessmentCourseData; student: AssessmentStudent } | null>(null);
  // 저장 결과를 즉시 반영하기 위한 로컬 오버레이 (서버 refresh 전까지)
  const [localRecords, setLocalRecords] = useState<Record<string, AssessmentRecord>>({});

  const recordOf = (c: AssessmentCourseData, studentId: string, phase: AssessmentPhase): AssessmentRecord | null =>
    localRecords[`${c.id}|${studentId}|${phase}`] ?? c.records[studentId]?.[phase] ?? null;

  const course = courses.find((c) => c.id === courseId) ?? null;

  if (courses.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
        {t(lang, "담당 중인 과정이 없습니다.", "No assigned courses yet.")}
      </div>
    );
  }

  // ── 1단계: 과정 카드 목록 ────────────────────────────────────────────
  if (!course) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {courses.map((c) => {
          const doneCount = (phase: AssessmentPhase) =>
            c.students.filter((s) => {
              const r = recordOf(c, s.id, phase);
              return r && scoredCount(r.scores) === ASSESSMENT_ITEM_KEYS.length;
            }).length;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCourseId(c.id)}
              className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-400 hover:shadow-md"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold text-slate-800">{c.name}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{c.schedule}</span>
                <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">
                  {t(lang, `학생 ${c.students.length}명`, `${c.students.length} student${c.students.length === 1 ? "" : "s"}`)}
                </span>
              </div>
              {/* 학생 이름 — 작게 아랫줄 */}
              <div className="mt-2 truncate text-[11px] text-slate-400">
                {c.students.map((s) => s.name).join(", ") || t(lang, "등록 학생 없음", "No students")}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                  Initial {doneCount("initial")}/{c.students.length}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                  Final {doneCount("final")}/{c.students.length}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // ── 2단계: 과정 내 교육생 리스트 ────────────────────────────────────
  return (
    <div>
      <button
        type="button"
        onClick={() => setCourseId(null)}
        className="mb-3 text-sm text-brand-600 hover:underline"
      >
        ← {t(lang, "과정 목록으로", "All courses")}
      </button>
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-base font-bold text-slate-800">{course.name}</div>
        <div className="mt-1 text-xs text-slate-500">
          {course.schedule} · {t(lang, `학생 ${course.students.length}명`, `${course.students.length} students`)}
        </div>
      </div>

      <div className="space-y-2">
        {course.students.map((s) => {
          const iRec = recordOf(course, s.id, "initial");
          const fRec = recordOf(course, s.id, "final");
          const hasAny = (iRec && scoredCount(iRec.scores) > 0) || (fRec && scoredCount(fRec.scores) > 0);
          return (
          <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-slate-800">{s.name}</div>
                {s.company && <div className="truncate text-[11px] italic text-slate-400">{s.company}</div>}
              </div>
              {(["initial", "final"] as const).map((phase) => {
                const r = recordOf(course, s.id, phase);
                const n = r ? scoredCount(r.scores) : 0;
                const complete = n === ASSESSMENT_ITEM_KEYS.length;
                const total = r ? totalOf(r.scores) : 0;
                const prof = r ? proficiencyOf(r.scores) : null;
                return (
                  <button
                    key={phase}
                    type="button"
                    onClick={() => setEditing({ course, student: s })}
                    className={
                      "rounded-md border px-2.5 py-1.5 text-left text-[11px] font-medium transition hover:border-brand-400 " +
                      (complete
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : n > 0
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-slate-50 text-slate-500")
                    }
                  >
                    <span className="font-bold">{phase === "initial" ? "Initial" : "Final"}</span>{" "}
                    {complete ? (
                      <>
                        {total}{t(lang, "점", " pts")} · {prof}
                      </>
                    ) : n > 0 ? (
                      `${n}/${ASSESSMENT_ITEM_KEYS.length}`
                    ) : (
                      t(lang, "미평가", "Not rated")
                    )}
                  </button>
                );
              })}
            </div>
            {/* 교육생별 Initial vs Final 그래프 — 강사·센터 전용 화면 */}
            {hasAny && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] font-semibold text-brand-600 hover:underline">
                  {t(lang, "점수 그래프 보기", "Show score graph")}
                </summary>
                <div className="mt-2 rounded-md border border-slate-100 bg-slate-50/50 p-2">
                  <AssessmentChart
                    initial={iRec?.scores ?? null}
                    final={fRec?.scores ?? null}
                    title={`${s.name} — Initial vs Final`}
                    height={200}
                  />
                </div>
              </details>
            )}
          </div>
          );
        })}
        {course.students.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            {t(lang, "이 과정에 등록된 학생이 없습니다.", "No students enrolled in this course.")}
          </div>
        )}
      </div>

      {editing && (
        <AssessmentEditorModal
          course={editing.course}
          student={editing.student}
          getRecord={(phase) => recordOf(editing.course, editing.student.id, phase)}
          onSaved={(phase, rec) =>
            setLocalRecords((m) => ({ ...m, [`${editing.course.id}|${editing.student.id}|${phase}`]: rec }))
          }
          onClose={() => setEditing(null)}
          lang={lang}
        />
      )}
    </div>
  );
}

// ── 3단계: 교육생별 평가 에디터 ───────────────────────────────────────
function AssessmentEditorModal({
  course,
  student,
  getRecord,
  onSaved,
  onClose,
  lang = "en",
}: {
  course: AssessmentCourseData;
  student: AssessmentStudent;
  getRecord: (phase: AssessmentPhase) => AssessmentRecord | null;
  onSaved: (phase: AssessmentPhase, rec: AssessmentRecord) => void;
  onClose: () => void;
  lang?: Lang;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<AssessmentPhase>("initial");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  // 단계별 점수/코멘트 초안 — 탭 전환 시에도 유지
  const [drafts, setDrafts] = useState<Record<AssessmentPhase, { scores: Record<string, number>; comment: string }>>(() => ({
    initial: {
      scores: { ...(getRecord("initial")?.scores ?? {}) },
      comment: getRecord("initial")?.comment ?? "",
    },
    final: {
      scores: { ...(getRecord("final")?.scores ?? {}) },
      comment: getRecord("final")?.comment ?? "",
    },
  }));

  const draft = drafts[phase];
  const total = useMemo(() => totalOf(draft.scores), [draft.scores]);
  const n = useMemo(() => scoredCount(draft.scores), [draft.scores]);
  const prof = useMemo(() => proficiencyOf(draft.scores), [draft.scores]);

  // 코멘트 입력창 — 내용 길이만큼 높이 자동 확장 (탭 전환·입력 시마다)
  const commentRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = commentRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + 2 + "px";
  }, [phase, draft.comment]);

  function setScore(itemKey: string, value: number) {
    setMsg(null);
    setDrafts((d) => {
      const cur = d[phase].scores[itemKey];
      const next = { ...d[phase].scores };
      if (cur === value) delete next[itemKey]; // 같은 점수 재클릭 → 해제
      else next[itemKey] = value;
      return { ...d, [phase]: { ...d[phase], scores: next } };
    });
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      const r = await saveTeacherAssessment({
        course_id: course.id,
        student_id: student.id,
        phase,
        scores: draft.scores,
        comment: draft.comment,
      });
      if (!r.ok) {
        setMsg({ type: "err", text: r.error ?? t(lang, "저장 실패", "Failed to save") });
        return;
      }
      onSaved(phase, { scores: { ...draft.scores }, comment: draft.comment.trim() || null });
      setMsg({ type: "ok", text: t(lang, "저장되었습니다.", "Saved.") });
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-lg sm:p-6"
      >
        {/* 헤더 + 단계 탭 + 저장 — 스크롤 중에도 상단에 고정되어 어디서든 저장 가능 */}
        <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-3 border-b border-slate-100 bg-white px-4 pb-2 pt-4 shadow-sm sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-5">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold text-slate-800">{student.name}</h3>
              <p className="truncate text-xs text-slate-500">
                {course.name} · {course.schedule}
              </p>
            </div>
            <button type="button" onClick={onClose} className="shrink-0 rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100">✕</button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
              {(["initial", "final"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setPhase(p); setMsg(null); }}
                  className={
                    "px-4 py-1.5 text-sm font-semibold transition " +
                    (phase === p ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50")
                  }
                >
                  {p === "initial" ? "Initial" : "Final"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500">
                {n}/{ASSESSMENT_ITEM_KEYS.length} · {total}{t(lang, "점", " pts")}
              </span>
              {msg && (
                <span className={"text-[11px] font-semibold " + (msg.type === "ok" ? "text-emerald-600" : "text-red-600")}>
                  {msg.text}
                </span>
              )}
              <button className="btn !px-3 !py-1.5 !text-xs" disabled={pending} onClick={save}>
                {pending ? t(lang, "저장 중...", "Saving...") : t(lang, "저장", "Save")}
              </button>
            </div>
          </div>
        </div>

        {/* 밴드 범례 */}
        <div className="mb-3 grid grid-cols-4 gap-1 text-center text-[10px] font-bold sm:text-[11px]">
          <div className={"rounded px-1 py-1 " + BAND_STYLE.novice.head}>Novice<br className="sm:hidden" /> 1–3</div>
          <div className={"rounded px-1 py-1 " + BAND_STYLE.intermediate.head}>Intermediate<br className="sm:hidden" /> 4–6</div>
          <div className={"rounded px-1 py-1 " + BAND_STYLE.advanced.head}>Advanced<br className="sm:hidden" /> 7–9</div>
          <div className={"rounded px-1 py-1 " + BAND_STYLE.superior.head}>Superior<br className="sm:hidden" /> 10</div>
        </div>

        {/* 영역별 점수 입력 */}
        <div className="space-y-3">
          {ASSESSMENT_GROUPS.map((g) => (
            <div key={g.key} className="overflow-hidden rounded-lg border border-slate-200">
              <div className="bg-slate-700 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
                {g.label}
              </div>
              <div className="divide-y divide-slate-100">
                {g.items.map((it) => {
                  const sel = draft.scores[it.key];
                  return (
                    <div key={it.key} className="px-3 py-2.5">
                      <div className="mb-1.5 flex items-baseline justify-between gap-2">
                        <div>
                          <div className="text-[13px] font-semibold text-slate-800">{it.en}</div>
                          <div className="text-[11px] text-slate-400">{it.ko}</div>
                        </div>
                        {sel != null && (
                          <span className="shrink-0 text-[11px] font-bold text-brand-700">
                            {sel} · {PROFICIENCY_LEVELS[sel - 1]}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 sm:gap-1.5">
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => {
                          const band = scoreBand(v);
                          const active = sel === v;
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setScore(it.key, v)}
                              aria-label={`${it.en} ${v}`}
                              className={
                                "flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold transition sm:h-8 sm:w-8 sm:text-xs " +
                                (active
                                  ? "border-brand-700 bg-brand-600 text-white shadow"
                                  : BAND_STYLE[band].idle + " hover:scale-110")
                              }
                            >
                              {v}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 코멘트 */}
        <label className="label mt-4">{t(lang, "코멘트 (선택)", "Comment (optional)")}</label>
        <textarea
          ref={commentRef}
          className="input min-h-[70px] resize-none overflow-hidden"
          placeholder={t(lang, "평가에 대한 코멘트를 남겨주세요.", "Optional comments about this assessment.")}
          value={draft.comment}
          disabled={pending}
          onChange={(e) => setDrafts((d) => ({ ...d, [phase]: { ...d[phase], comment: e.target.value } }))}
        />

        {/* 총점 · 숙련도 배너 (평가표 하단과 동일한 구성) */}
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-300">
          <div className="grid grid-cols-2 text-center sm:grid-cols-4">
            <div className="bg-slate-700 px-2 py-2.5 text-xs font-bold text-white sm:text-sm">{t(lang, "총점", "Total")}</div>
            <div className="bg-yellow-300 px-2 py-2.5 text-sm font-extrabold text-slate-900 sm:text-base">
              {total}{t(lang, "점", " pts")}
              <span className="ml-1 text-[10px] font-semibold text-slate-600">({n}/{ASSESSMENT_ITEM_KEYS.length})</span>
            </div>
            <div className="bg-slate-700 px-2 py-2.5 text-xs font-bold text-white sm:text-sm">Proficiency Level</div>
            <div className="bg-yellow-300 px-2 py-2.5 text-sm font-extrabold text-slate-900 sm:text-base">
              {prof ?? "—"}
            </div>
          </div>
        </div>

        {/* Initial vs Final 비교 그래프 (현재 입력값 기준 실시간) */}
        {(scoredCount(drafts.initial.scores) > 0 || scoredCount(drafts.final.scores) > 0) && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/50 p-2">
            <AssessmentChart
              initial={drafts.initial.scores}
              final={drafts.final.scores}
              title={`${student.name} — Initial vs Final`}
              height={210}
            />
          </div>
        )}

        {msg && (
          <div
            className={
              "mt-3 rounded-md border p-2 text-sm " +
              (msg.type === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700")
            }
          >
            {msg.text}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>{t(lang, "닫기", "Close")}</button>
          <button className="btn" disabled={pending} onClick={save}>
            {pending
              ? t(lang, "저장 중...", "Saving...")
              : t(lang, `${phase === "initial" ? "Initial" : "Final"} 평가 저장`, `Save ${phase === "initial" ? "Initial" : "Final"}`)}
          </button>
        </div>
      </div>
    </div>
  );
}
