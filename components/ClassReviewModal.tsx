"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveClassReview } from "@/lib/actions/student-feedback";

/** 완료된 수업 후기 팝업 — 별점(1~5) + 선택 의견. */
export default function ClassReviewModal({
  slotId,
  teacherId,
  teacherName,
  classInfo,
  onClose,
}: {
  slotId: string;
  teacherId: string;
  teacherName: string;
  classInfo: string;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 기존 후기 불러오기 (RLS: 본인 것만)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("class_reviews")
        .select("rating, comment")
        .eq("slot_id", slotId)
        .maybeSingle();
      if (!cancelled && data) {
        setRating(data.rating ?? null);
        setComment(data.comment ?? "");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, slotId]);

  function save() {
    setMsg(null);
    startTransition(async () => {
      const r = await saveClassReview({
        slot_id: slotId,
        teacher_id: teacherId,
        rating,
        comment: comment.trim() || null,
      });
      if (!r.ok) {
        setMsg({ type: "err", text: r.error ?? "저장 실패" });
        return;
      }
      setMsg({ type: "ok", text: "수업후기가 저장되었습니다." });
      router.refresh();
      setTimeout(onClose, 700);
    });
  }

  const display = hover ?? rating ?? 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-800">수업후기</h3>
        <p className="mt-1 text-sm text-slate-500">
          {teacherName} 강사 · {classInfo}
        </p>

        {/* 별점 */}
        <div className="mt-4 flex items-center justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n}점`}
              disabled={loading}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setRating(rating === n ? null : n)}
              className="text-4xl leading-none transition"
            >
              <span className={n <= display ? "text-amber-400" : "text-slate-300"}>★</span>
            </button>
          ))}
        </div>
        <p className="mt-1 text-center text-xs text-slate-400">
          {rating ? `${rating} / 5` : "별을 눌러 점수를 주세요"}
        </p>

        {/* 의견 (선택) */}
        <label className="label mt-4">의견/요청 (option)</label>
        <textarea
          className="input min-h-[90px]"
          placeholder="수업에 대한 의견이나 요청사항을 자유롭게 남겨주세요 (선택)"
          value={comment}
          disabled={pending || loading}
          onChange={(e) => setComment(e.target.value)}
        />

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
          <button className="btn-ghost" onClick={onClose}>닫기</button>
          <button className="btn" disabled={pending || loading} onClick={save}>
            {pending ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
