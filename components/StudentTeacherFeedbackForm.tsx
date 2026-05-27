"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStudentTeacherFeedback } from "@/lib/actions/student-feedback";

/**
 * Student → Teacher feedback form (1-10 scale + comment).
 * Shown in the student's 수강현황 page next to the assigned teacher.
 */
export default function StudentTeacherFeedbackForm({
  teacherId,
  teacherName,
  initialRating,
  initialComment,
}: {
  teacherId: string;
  teacherName: string;
  initialRating: number | null;
  initialComment: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rating, setRating] = useState<number | null>(initialRating);
  const [comment, setComment] = useState(initialComment ?? "");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function pick(n: number) {
    setRating(rating === n ? null : n);
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      const r = await saveStudentTeacherFeedback({
        teacher_id: teacherId,
        rating,
        comment: comment.trim() || null,
      });
      if (!r.ok) { setMsg({ type: "err", text: r.error ?? "저장 실패" }); return; }
      setMsg({ type: "ok", text: "강사 평가가 저장되었습니다." });
      router.refresh();
    });
  }

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50/60 p-4">
      <h4 className="mb-2 text-sm font-semibold text-slate-700">
        ⭐ {teacherName} 강사 평가
      </h4>
      <p className="mb-3 text-xs text-slate-500">
        수업에 대한 만족도를 1~10점으로 평가하고 자유롭게 의견을 남겨주세요. (강사·관리자가 확인)
      </p>

      {/* 1-10 점수 버튼 */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
          const active = rating != null && n <= rating;
          const selected = rating === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => pick(n)}
              className={
                "h-9 w-9 rounded-md border text-sm font-semibold transition " +
                (selected
                  ? "border-amber-500 bg-amber-500 text-white"
                  : active
                    ? "border-amber-300 bg-amber-100 text-amber-700"
                    : "border-slate-300 bg-white text-slate-500 hover:border-amber-400")
              }
            >
              {n}
            </button>
          );
        })}
        {rating != null && (
          <span className="ml-2 self-center text-sm font-bold text-amber-700">{rating}/10</span>
        )}
      </div>

      {/* 코멘트 */}
      <label className="label text-xs">코멘트 (선택)</label>
      <textarea
        className="input min-h-[80px] text-sm"
        placeholder="강사님께 전하고 싶은 의견을 자유롭게 적어주세요."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
      />
      <div className="mt-1 text-right text-xs text-slate-400">{comment.length} / 1,000</div>

      {msg && (
        <div className={
          "mt-2 rounded-md border p-2 text-sm " +
          (msg.type === "ok"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700")
        }>{msg.text}</div>
      )}

      <div className="mt-3 flex justify-end">
        <button type="button" onClick={save} disabled={pending} className="btn">
          {pending ? "저장 중..." : "강사 평가 저장"}
        </button>
      </div>
    </div>
  );
}
