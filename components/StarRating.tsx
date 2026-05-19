"use client";

/**
 * 5-star interactive rating component.
 *  - Click a star to set that value (1-5).
 *  - Click the same star again to clear (set to null).
 *  - Optional `readOnly` to display only.
 */
export default function StarRating({
  value,
  onChange,
  size = "md",
  readOnly = false,
}: {
  value: number | null;
  onChange?: (v: number | null) => void;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
}) {
  const sizeClass =
    size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl";

  function setRating(n: number) {
    if (readOnly || !onChange) return;
    // Clicking the same star clears it
    onChange(value === n ? null : n);
  }

  return (
    <div className={"inline-flex items-center gap-0.5 " + sizeClass}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value != null && n <= value;
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => setRating(n)}
            className={
              "select-none transition " +
              (filled ? "text-amber-400" : "text-slate-300") +
              (readOnly ? " cursor-default" : " hover:scale-110 cursor-pointer")
            }
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
          >
            ★
          </button>
        );
      })}
      {value != null && (
        <span className="ml-2 text-xs font-medium text-slate-500">{value}/5</span>
      )}
    </div>
  );
}
