"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import LikertScale from "@/components/LikertScale";
import { saveFeedback } from "@/lib/actions/feedback";
import type { Feedback, FeedbackKey } from "@/lib/types";

interface Props {
  bookingId: string;
  studentName: string;
  classInfo?: string; // e.g. "Tue, May 19 · 09:00 - 10:00"
  existing: Partial<Feedback> | null;
  onClose: () => void;
}

type Ratings = Partial<Record<FeedbackKey, number | null>>;

export default function FeedbackModal({
  bookingId, studentName, classInfo, existing, onClose,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const init: Ratings = {
    grammar_accuracy:     existing?.grammar_accuracy     ?? null,
    grammar_complexity:   existing?.grammar_complexity   ?? null,
    vocabulary_diversity: existing?.vocabulary_diversity ?? null,
    vocabulary_relevancy: existing?.vocabulary_relevancy ?? null,
    comprehension:        existing?.comprehension        ?? null,
    content_clarity:      existing?.content_clarity      ?? null,
    content_organization: existing?.content_organization ?? null,
    participation:        existing?.participation        ?? null,
    tone_manner:          existing?.tone_manner          ?? null,
    preparation:          existing?.preparation          ?? null,
  };

  const [ratings, setRatings] = useState<Ratings>(init);
  // 기본 코멘트: 기존 값이 있으면 그걸 쓰고, 없으면 자동 생성 메시지 (수정 가능)
  const [comment, setComment] = useState(
    existing?.comment ?? `Hi ${studentName}, you did a great job today. `
  );

  function set(key: FeedbackKey, v: number | null) {
    setRatings((r) => ({ ...r, [key]: v }));
  }

  // Average of provided ratings (preview only)
  const filled = Object.values(ratings).filter((v) => v != null) as number[];
  const avg = filled.length === 0 ? null : (filled.reduce((s, n) => s + n, 0) / filled.length);

  function save() {
    setMsg(null);
    startTransition(async () => {
      const r = await saveFeedback(bookingId, { ...ratings, comment });
      if (!r.ok) { setMsg({ type: "err", text: r.error ?? "Failed to save" }); return; }
      setMsg({ type: "ok", text: "Saved." });
      router.refresh();
      setTimeout(onClose, 600);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <header className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">📝 Class Feedback</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              <b>{studentName}</b>
              {classInfo ? ` · ${classInfo}` : ""}
            </p>
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

        <p className="mb-4 text-xs text-slate-500">
          Click a number from 1 to 10 to rate each item. Click the same number again to clear.
          Unrated items are excluded from the average.
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

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
          <button type="button" className="btn" disabled={pending} onClick={save}>
            {pending ? "Saving..." : "Save feedback"}
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
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-slate-700">{label}</span>
      <LikertScale value={value} onChange={onChange} />
    </div>
  );
}
