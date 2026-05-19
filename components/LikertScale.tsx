"use client";

/**
 * 10-point Likert rating. Clickable buttons 1..10.
 * Click the active number again to clear.
 */
export default function LikertScale({
  value,
  onChange,
  readOnly = false,
}: {
  value: number | null;
  onChange?: (v: number | null) => void;
  readOnly?: boolean;
}) {
  function setValue(n: number) {
    if (readOnly || !onChange) return;
    onChange(value === n ? null : n);
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => setValue(n)}
            className={
              "h-7 w-7 rounded-md border text-xs font-semibold transition " +
              (active
                ? "border-brand-600 bg-brand-600 text-white shadow"
                : "border-slate-300 bg-white text-slate-700 hover:border-brand-500 hover:bg-brand-50") +
              (readOnly ? " cursor-default" : "")
            }
            aria-pressed={active}
            aria-label={`${n} out of 10`}
          >
            {n}
          </button>
        );
      })}
      {value != null && (
        <span className="ml-2 text-xs font-semibold text-slate-600">
          {value}/10
        </span>
      )}
    </div>
  );
}
