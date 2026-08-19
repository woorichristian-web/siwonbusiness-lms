"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** 관리자 네비 — 마이페이지 클릭 시 하단에 DB 관리·회원 관리가 함께 열린다. */
export default function NavMyPageDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const items = [
    { href: "/admin/profile", label: "마이페이지" },
    { href: "/admin/upload", label: "DB 관리" },
    { href: "/admin/users", label: "회원 관리" },
  ];
  const active = items.some(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
  );

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          "relative rounded-md px-3 py-1.5 font-medium transition " +
          (active
            ? "font-semibold text-amber-300 [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]"
            : "text-blue-100 hover:bg-white/10 hover:text-white")
        }
      >
        마이페이지 <span className="text-[10px]">▾</span>
        {active && (
          <span className="absolute inset-x-2 -bottom-[7px] h-0.5 rounded-full bg-amber-300 shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-xl">
          {items.map((i) => {
            const cur = pathname === i.href || pathname.startsWith(i.href + "/");
            return (
              <Link
                key={i.href}
                href={i.href}
                className={
                  "block px-3.5 py-2 text-sm transition " +
                  (cur
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-slate-700 hover:bg-slate-50")
                }
              >
                {i.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
