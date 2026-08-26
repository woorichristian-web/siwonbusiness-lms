"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitSurvey } from "@/lib/actions/survey";

export interface PendingSurvey {
  courseId: string;
  courseName: string;
  round: 1 | 2 | 3;
  label: string;      // "10%" | "50%" | "Final"
  closeDate: string;  // ISO
}

const ROUND_KO: Record<string, string> = { "4주차": "초기(4주차)", "10%": "초기(10% 시점)", "50%": "중간(50% 시점)", Final: "최종(마지막 수업일)" };

/**
 * 만족도 설문 팝업 — 응답 기간(배포 후 7일) 동안 로그인/페이지 방문 시 자동 표시.
 * 제출하면 사라지고, [나중에]는 이번 세션에서만 숨긴다(다음 방문 시 다시 표시).
 */
export default function SurveyPopup({ surveys }: { surveys: PendingSurvey[] }) {
  const [queue, setQueue] = useState<PendingSurvey[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = surveys.filter(
      (s) => !sessionStorage.getItem(`survey_later_${s.courseId}_${s.round}`),
    );
    setQueue(q);
  }, [surveys]);

  if (queue.length === 0) return null;
  return <SurveyModal queue={queue} setQueue={setQueue} rememberLater />;
}

/**
 * "수업후기 쓰기" 버튼 — 응답 기간 중에만 렌더링되고,
 * 누르면 설문 폼이 열린다. ([나중에]로 팝업을 닫았더라도 다시 열 수 있음)
 */
export function SurveyButton({
  surveys,
  label = "수업후기 쓰기",
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
  /** true 면 [나중에]가 세션 동안 자동 팝업을 숨긴다 (자동 팝업용) */
  rememberLater?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const cur = queue[0];
  if (!cur) return null;

  function advance() {
    setQueue((q) => {
      const next = q.slice(1);
      if (next.length === 0) onClose?.();
      return next;
    });
    setRating(null); setComment(""); setErr(null);
  }

  function later() {
    if (rememberLater)
      sessionStorage.setItem(`survey_later_${cur.courseId}_${cur.round}`, "1");
    advance();
  }

  function submit() {
    if (rating == null) { setErr("만족도 점수를 선택해 주세요."); return; }
    setErr(null);
    startTransition(async () => {
      const r = await submitSurvey({
        courseId: cur.courseId, round: cur.round, rating, comment: comment.trim() || null,
      });
      if (!r.ok) { setErr(r.error); return; }
      advance();
      router.refresh();
    });
  }

  const dday = Math.max(0, Math.ceil((new Date(cur.closeDate).getTime() - Date.now()) / 86400000));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
            만족도 설문
          </span>
          <span className="text-xs text-slate-400">응답 마감까지 D-{dday}</span>
        </div>
        <h3 className="text-lg font-bold text-slate-800">{cur.courseName}</h3>
        <p className="mt-0.5 text-sm text-slate-500">
          {ROUND_KO[cur.label] ?? cur.label} 설문입니다. 수업 만족도를 알려주세요.
          <br />응답은 <b>익명으로 취합</b>되어 강사에게 전달됩니다.
        </p>

        <div className="mt-4">
          <label className="label">만족도 (1~10점)</label>
          <div className="flex flex-wrap gap-1.5">
            {[1,2,3,4,5,6,7,8,9,10].map((n) => {
              const active = rating != null && n <= rating;
              const sel = rating === n;
              return (
                <button key={n} type="button" onClick={() => setRating(rating === n ? null : n)}
                  className={"h-9 w-9 rounded-md border text-sm font-semibold transition " +
                    (sel ? "border-amber-500 bg-amber-500 text-white"
                      : active ? "border-amber-300 bg-amber-100 text-amber-700"
                      : "border-slate-300 bg-white text-slate-500 hover:border-amber-400")}>
                  {n}
                </button>
              );
            })}
            {rating != null && <span className="ml-1 self-center text-sm font-bold text-amber-700">{rating}/10</span>}
          </div>
        </div>

        <div className="mt-4">
          <label className="label">의견 / 요청 (선택)</label>
          <textarea className="input min-h-[90px]"
            placeholder="수업에 대한 의견이나 강사님께 바라는 점을 자유롭게 적어주세요."
            value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>

        {err && <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={later} disabled={pending}>나중에 하기</button>
          <button className="btn" onClick={submit} disabled={pending || rating == null}>
            {pending ? "제출 중..." : "제출"}
          </button>
        </div>
      </div>
    </div>
  );
}
