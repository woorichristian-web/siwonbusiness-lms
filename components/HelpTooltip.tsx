"use client";

import { useState } from "react";

/** 물음표(?) 버튼 — 마우스를 올리면(모바일은 탭) 안내 버블을 띄운다. */
export default function HelpTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label="도움말"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-[10px] font-bold leading-none text-white transition hover:bg-slate-500"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-6 z-30 w-64 -translate-x-1/2 whitespace-pre-line rounded-lg bg-slate-800 px-3 py-2 text-left text-xs font-normal leading-relaxed text-white shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
