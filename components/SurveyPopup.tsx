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

const ROUND_KO: Record<string, string> = { "10%": "초기(10% 시점)", "50%": "중간(50% 시점)", Final: "최종(종료일)" };

/**
 * 만족도 설문 팝업 — 응답 기간(배포 후 7일) 동안 로그인/페이지 방문 시 자동 표시.
 * 제출하면 사라지고, [나중에]는 이번 세션에서만 숨긴다(다음 방문 시 다시 표시).
 */
export default function SurveyPopup({ surveys }: { surveys: PendingSurvey[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [queue, setQueue] = useState<PendingSurvey[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = surveys.filter(
      (s) => !sessionStorage.getItem(`survey_later_${s.courseId}_${s.round}`),
    );
    setQueue(q);
  }, [surveys]);

  const cur = queue[0];
  if (!cur) return null;

  function later() {
    sessionStorage.setItem(`survey_later_${cur.courseId}_${cur.round}`, "1");
    setQueue((q) => q.slice(1));
    setRating(null); setComment(""); setErr(null);
  }

  function submit() {
    if (rating == null) { setErr("만족도 점수를 선택해 주세요."); return; }
    setErr(null);
    startTransition(async () => {
      const r = await submitSurvey({
        courseId: cur.courseId, round: cur.round, rating, comment: comment.trim() || null,
      });
      if (!r.ok) { setErr(r.error); return; }
      setQueue((q) => q.slice(1));
      setRating(null); setComment("");
      router.refresh();
    });
  }

  const dday = Math.max(0, Math.ceil((new Date(cur.closeDate).getTime() - Date.now()) / 86400000));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
            📋 만족도 설문
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
