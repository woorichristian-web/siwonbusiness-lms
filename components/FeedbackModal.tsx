"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import StarRating from "@/components/StarRating";
import { saveFeedback } from "@/lib/actions/feedback";
import type { Feedback, FeedbackKey } from "@/lib/types";

export interface SessionEntry {
  booking_id: string;
  start_at: string;
  end_at: string;
  attendance_marked: boolean;
  feedback: Feedback | null;
}

interface Props {
  studentName: string;
  studentSessions: SessionEntry[];   // 학생의 모든 과거 수업 (이 강사)
  initialBookingId: string;
  onClose: () => void;
}

type Ratings = Partial<Record<FeedbackKey, number | null>>;

function isComplete(fb: Feedback | null | undefined): boolean {
  if (!fb) return false;
  if (fb.status !== "submitted") return false;
  return true;
}

function ratingsFromFeedback(fb: Feedback | null): Ratings {
  return {
    grammar_accuracy:     fb?.grammar_accuracy     ?? null,
    grammar_complexity:   fb?.grammar_complexity   ?? null,
    vocabulary_diversity: fb?.vocabulary_diversity ?? null,
    vocabulary_relevancy: fb?.vocabulary_relevancy ?? null,
    comprehension:        fb?.comprehension        ?? null,
    content_clarity:      fb?.content_clarity      ?? null,
    content_organization: fb?.content_organization ?? null,
    participation:        fb?.participation        ?? null,
    tone_manner:          fb?.tone_manner          ?? null,
    preparation:          fb?.preparation          ?? null,
  };
}

export default function FeedbackModal({
  studentName, studentSessions, initialBookingId, onClose,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 과거 수업만 필터 (미래 수업은 평가 불가)
  const pastSessions = useMemo(() => {
    const now = Date.now();
    return studentSessions
      .filter((s) => new Date(s.end_at).getTime() <= now)
      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());
  }, [studentSessions]);

  // 현재 선택된 세션
  const [selectedBookingId, setSelectedBookingId] = useState(initialBookingId);
  const selectedSession = pastSessions.find((s) => s.booking_id === selectedBookingId)
    ?? pastSessions[0];

  // 현재 세션의 ratings, comment 상태
  const [ratings, setRatings] = useState<Ratings>(() =>
    ratingsFromFeedback(selectedSession?.feedback ?? null)
  );
  const [comment, setComment] = useState(
    selectedSession?.feedback?.comment ?? `Hi ${studentName}, you did a great job today. `
  );

  // 세션 전환 시 상태 갱신
  useEffect(() => {
    if (!selectedSession) return;
    setRatings(ratingsFromFeedback(selectedSession.feedback));
    setComment(
      selectedSession.feedback?.comment
        ?? `Hi ${studentName}, you did a great job today. `
    );
    setMsg(null);
  }, [selectedBookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(key: FeedbackKey, v: number | null) {
    setRatings((r) => ({ ...r, [key]: v }));
  }

  const filled = Object.values(ratings).filter((v) => v != null) as number[];
  const avg = filled.length === 0 ? null : (filled.reduce((s, n) => s + n, 0) / filled.length);

  function save(status: "draft" | "submitted") {
    if (!selectedSession) return;
    setMsg(null);
    startTransition(async () => {
      const r = await saveFeedback(
        selectedSession.booking_id,
        { ...ratings, comment },
        status,
      );
      if (!r.ok) { setMsg({ type: "err", text: r.error ?? "Failed to save" }); return; }
      setMsg({
        type: "ok",
        text: status === "draft" ? "Draft saved." : "Submitted.",
      });
      router.refresh();
      if (status === "submitted") {
        setTimeout(onClose, 700);
      }
    });
  }

  if (!selectedSession) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="rounded-lg bg-white p-6 shadow-xl">
          <p className="text-sm text-slate-600">No past sessions for this student.</p>
          <button className="btn-ghost mt-4" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const start = new Date(selectedSession.start_at);
  const end = new Date(selectedSession.end_at);
  const classInfo =
    start.toLocaleDateString("en-US", { weekday: "short", month: "2-digit", day: "2-digit" })
    + " · "
    + start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
    + " - "
    + end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <header className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">📝 Class Feedback</h3>
            <p className="mt-0.5 text-sm text-slate-500"><b>{studentName}</b> · {classInfo}</p>
          </div>
          {filled.length > 0 && (
            <div className="rounded-md bg-amber-50 px-3 py-1.5 text-right text-xs">
              <div className="text-slate-500">Average</div>
              <div className="text-lg font-bold text-amber-700">
                {avg!.toFixed(2)}
                <span className="text-xs font-normal text-slate-400"> / 10.00</span>
              </div>
            </div>
          )}
        </header>

        {/* Date strip — all past sessions, red for unevaluated */}
        <section className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              📅 Select session
            </h4>
            <span className="text-xs text-slate-400">
              {pastSessions.length} sessions · 🔴 unevaluated
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {pastSessions.map((s) => {
              const isSelected = s.booking_id === selectedBookingId;
              const complete = isComplete(s.feedback) && s.attendance_marked;
              const d = new Date(s.start_at);
              const label = d.toLocaleDateString("en-US", {
                month: "2-digit", day: "2-digit",
              }) + " · " + d.toLocaleTimeString("en-US", {
                hour: "2-digit", minute: "2-digit", hour12: false,
              });
              return (
                <button
                  key={s.booking_id}
                  type="button"
                  onClick={() => setSelectedBookingId(s.booking_id)}
                  className={
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition " +
                    (isSelected
                      ? "border-brand-600 bg-brand-600 text-white"
                      : complete
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-500"
                        : "border-red-300 bg-red-50 text-red-700 hover:border-red-500")
                  }
                >
                  {!complete && <span className="mr-1">🔴</span>}
                  {complete && <span className="mr-1">✓</span>}
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        <p className="mb-4 text-xs text-slate-500">
          Rate each item from 1 to 10. Click the same number again to clear. Unrated items are excluded from the average.
        </p>

        {/* LANGUAGE */}
        <Section title="🗣️ Language">
          <SubSection title="Grammar">
            <RatingRow label="Accuracy" value={ratings.grammar_accuracy!}
              onChange={(v) => set("grammar_accuracy", v)} />
            <RatingRow label="Complexity" value={ratings.grammar_complexity!}
              onChange={(v) => set("grammar_complexity", v)} />
          </SubSection>

          <SubSection title="Vocabulary">
            <RatingRow label="Diversity" value={ratings.vocabulary_diversity!}
              onChange={(v) => set("vocabulary_diversity", v)} />
            <RatingRow label="Relevancy" value={ratings.vocabulary_relevancy!}
              onChange={(v) => set("vocabulary_relevancy", v)} />
          </SubSection>

          <RatingRow label="Comprehension" value={ratings.comprehension!}
            onChange={(v) => set("comprehension", v)} />

          <SubSection title="Content & Message">
            <RatingRow label="Clarity" value={ratings.content_clarity!}
              onChange={(v) => set("content_clarity", v)} />
            <RatingRow label="Organization" value={ratings.content_organization!}
              onChange={(v) => set("content_organization", v)} />
          </SubSection>
        </Section>

        {/* ATTITUDE */}
        <Section title="🤝 Attitude">
          <RatingRow label="Participation" value={ratings.participation!}
            onChange={(v) => set("participation", v)} />
          <RatingRow label="Tone & Manner" value={ratings.tone_manner!}
            onChange={(v) => set("tone_manner", v)} />
          <RatingRow label="Preparation" value={ratings.preparation!}
            onChange={(v) => set("preparation", v)} />
        </Section>

        {/* COMMENT */}
        <div className="mt-4">
          <label className="label">Comment (optional)</label>
          <textarea
            className="input min-h-[100px]"
            placeholder="Overall impression, strengths, areas to improve, suggested practice…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        {msg && (
          <div className={
            "mt-3 rounded-md border p-2 text-sm " +
            (msg.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700")
          }>{msg.text}</div>
        )}

        {selectedSession.feedback?.status === "draft" && (
          <p className="mt-3 text-xs text-amber-700">
            ⚠️ This feedback is saved as a draft. It will not be included in averages or reports until you Submit.
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
          <button
            type="button"
            className="btn-ghost border border-slate-300"
            disabled={pending}
            onClick={() => save("draft")}
          >
            {pending ? "Saving..." : "💾 Save draft"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={pending}
            onClick={() => save("submitted")}
          >
            {pending ? "Submitting..." : "✓ Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <h4 className="mb-3 text-base font-semibold text-slate-800">{title}</h4>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h5>
      <div className="space-y-2 pl-2">{children}</div>
    </div>
  );
}

function RatingRow({
  label, value, onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-slate-700">{label}</span>
      <StarRating value={value} onChange={onChange} />
    </div>
  );
}
