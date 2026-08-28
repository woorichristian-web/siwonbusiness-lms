"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitSurvey } from "@/lib/actions/survey";
import { SURVEY_QUESTIONS } from "@/lib/survey";

export interface PendingSurvey {
  courseId: string;
  courseName: string;
  round: 1 | 2 | 3;
  label: string;      // "4주차" | "50%" | "Final"
  closeDate: string;  // ISO
}

const ROUND_KO: Record<string, string> = { "4주차": "초기(4주차)", "10%": "초기(10% 시점)", "50%": "중간(50% 시점)", Final: "최종(마지막 수업 주)" };
const SCALE_LABEL: Record<number, string> = { 5: "매우 그렇다", 4: "그렇다", 3: "보통이다", 2: "그렇지 않다", 1: "전혀 그렇지 않다" };

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * 만족도 설문 팝업 — 응답 기간 동안 로그인/페이지 방문 시 자동 표시.
 * [나중에]는 "오늘 하루" 숨김 — 제출할 때까지 매일 다시 표시된다(일일 리마인더).
 */
export default function SurveyPopup({ surveys }: { surveys: PendingSurvey[] }) {
  const [queue, setQueue] = useState<PendingSurvey[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const today = todayYmd();
      const q = surveys.filter(
        (s) => localStorage.getItem(`survey_later_${s.courseId}_${s.round}`) !== today,
      );
      setQueue(q);
    } catch {
      setQueue(surveys);
    }
  }, [surveys]);

  if (queue.length === 0) return null;
  return <SurveyModal queue={queue} setQueue={setQueue} rememberLater />;
}

/**
 * "만족도 조사" 버튼 — 응답 기간 중에만 렌더링되고, 누르면 설문 폼이 열린다.
 * ([나중에]로 팝업을 닫았더라도 이 버튼으로 언제든 다시 열 수 있음)
 */
export function SurveyButton({
  surveys,
  label = "만족도 조사",
  className,
}: {
  surveys: PendingSurvey[];
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [queue, setQueue] = useState<PendingSurvey[]>([]);
  if (surveys.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => { setQueue(surveys); setOpen(true); }}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-amber-600"
        }
      >
        {label}
        <span className="rounded-full bg-white/25 px-1.5 text-[10px] font-bold">{surveys.length}</span>
      </button>
      {open && queue.length > 0 && (
        <SurveyModal queue={queue} setQueue={setQueue} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function SurveyModal({
  queue,
  setQueue,
  rememberLater = false,
  onClose,
}: {
  queue: PendingSurvey[];
  setQueue: React.Dispatch<React.SetStateAction<PendingSurvey[]>>;
  /** true 면 [나중에]가 오늘 하루 자동 팝업을 숨긴다 (내일 다시 표시 — 일일 리마인더) */
  rememberLater?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const cur = queue[0];
  if (!cur) return null;

  const answered = SURVEY_QUESTIONS.filter((q) => answers[q.key] != null).length;
  const allAnswered = answered === SURVEY_QUESTIONS.length;

  function advance() {
    setQueue((q) => {
      const next = q.slice(1);
      if (next.length === 0) onClose?.();
      return next;
    });
    setAnswers({}); setStrengths(""); setImprovements(""); setErr(null);
  }

  function later() {
    if (rememberLater) {
      try { localStorage.setItem(`survey_later_${cur.courseId}_${cur.round}`, todayYmd()); } catch { /* 무시 */ }
    }
    advance();
  }

  function submit() {
    if (!allAnswered) { setErr(`모든 문항에 응답해 주세요. (${answered}/${SURVEY_QUESTIONS.length})`); return; }
    setErr(null);
    startTransition(async () => {
      const r = await submitSurvey({
        courseId: cur.courseId,
        round: cur.round,
        answers,
        strengths: strengths.trim() || null,
        improvements: improvements.trim() || null,
      });
      if (!r.ok) { setErr(r.error); return; }
      try { localStorage.removeItem(`survey_later_${cur.courseId}_${cur.round}`); } catch { /* 무시 */ }
      advance();
      router.refresh();
    });
  }

  const dday = Math.max(0, Math.ceil((new Date(cur.closeDate).getTime() - Date.now()) / 86400000));

  // 카테고리별 그룹
  const groups: { cat: string; items: typeof SURVEY_QUESTIONS }[] = [];
  for (const q of SURVEY_QUESTIONS) {
    const g = groups.find((x) => x.cat === q.cat);
    if (g) g.items.push(q);
    else groups.push({ cat: q.cat, items: [q] });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-4 shadow-2xl sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
            교육생 만족도 조사
          </span>
          <span className="text-xs text-slate-400">응답 마감까지 D-{dday}</span>
        </div>
        <h3 className="text-lg font-bold text-slate-800">{cur.courseName}</h3>
        <p className="mt-0.5 text-sm text-slate-500">
          {ROUND_KO[cur.label] ?? cur.label} 설문입니다. 응답은 <b>익명으로 취합</b>되어 강사에게 전달됩니다.
        </p>
        {/* 척도 안내 */}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 rounded-md bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          {[5, 4, 3, 2, 1].map((n) => (
            <span key={n}><b className="text-slate-700">{n}</b> {SCALE_LABEL[n]}</span>
          ))}
        </div>

        {/* 객관식 10문항 — 카테고리별 */}
        {groups.map((g) => (
          <div key={g.cat} className="mt-4">
            <div className="rounded-t-md bg-slate-700 px-3 py-1.5 text-xs font-bold tracking-wide text-white">
              {g.cat}
            </div>
            <div className="divide-y divide-slate-100 rounded-b-md border border-t-0 border-slate-200">
              {g.items.map((q) => {
                const no = SURVEY_QUESTIONS.findIndex((x) => x.key === q.key) + 1;
                return (
                  <div key={q.key} className="px-3 py-2.5">
                    <p className="mb-1.5 text-[13px] leading-snug text-slate-700">
                      <span className="mr-1 font-bold text-slate-400">{no}.</span>
                      {q.text}
                      {answers[q.key] != null && (
                        <span className="ml-1.5 text-[11px] font-bold text-amber-600">
                          {answers[q.key]} · {SCALE_LABEL[answers[q.key]]}
                        </span>
                      )}
                    </p>
                    <div className="flex gap-1.5">
                      {[5, 4, 3, 2, 1].map((n) => {
                        const sel = answers[q.key] === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setAnswers((a) => {
                              const next = { ...a };
                              if (next[q.key] === n) delete next[q.key];
                              else next[q.key] = n;
                              return next;
                            })}
                            className={
                              "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold transition " +
                              (sel
                                ? "border-amber-500 bg-amber-500 text-white shadow-sm"
                                : "border-slate-300 bg-white text-slate-500 hover:border-amber-400 hover:text-amber-600")
                            }
                            aria-label={`${n}점 ${SCALE_LABEL[n]}`}
                          >
                            {n}
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

        {/* 주관식 2문항 */}
        <div className="mt-4">
          <div className="rounded-t-md bg-slate-700 px-3 py-1.5 text-xs font-bold tracking-wide text-white">주관식 의견 (선택)</div>
          <div className="space-y-3 rounded-b-md border border-t-0 border-slate-200 px-3 py-3">
            <div>
              <label className="mb-1 block text-[13px] text-slate-700">
                1. 이번 교육에서 가장 만족스러웠던 점이나 도움이 되었던 부분을 자유롭게 작성해 주십시오.
              </label>
              <textarea className="input min-h-[64px]" value={strengths}
                onChange={(e) => setStrengths(e.target.value)} placeholder="자유롭게 작성해 주세요." />
            </div>
            <div>
              <label className="mb-1 block text-[13px] text-slate-700">
                2. 향후 교육 과정에서 개선하거나 추가되었으면 하는 사항을 자유롭게 작성해 주십시오.
              </label>
              <textarea className="input min-h-[64px]" value={improvements}
                onChange={(e) => setImprovements(e.target.value)} placeholder="자유롭게 작성해 주세요." />
            </div>
          </div>
        </div>

        {err && <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</p>}

        <div className="sticky bottom-0 -mx-4 mt-4 flex items-center justify-between gap-2 border-t border-slate-100 bg-white px-4 py-3 sm:-mx-6 sm:px-6">
          <span className="text-xs text-slate-400">응답 {answered}/{SURVEY_QUESTIONS.length}</span>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={later} disabled={pending}>나중에 하기</button>
            <button className="btn" onClick={submit} disabled={pending || !allAnswered}>
              {pending ? "제출 중..." : "제출"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
