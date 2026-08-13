"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 상단 네비 링크 — 현재 경로면 강조 표시. */
export default function NavLink({
  href,
  children,
  badge,
}: {
  href: string;
  children: React.ReactNode;
  badge?: number;
}) {
  const pathname = usePathname();
  const active =
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "relative rounded-md px-3 py-1.5 font-medium transition " +
        (active
          ? "font-semibold text-amber-300 [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]"
          : "text-blue-100 hover:bg-white/10 hover:text-white")
      }
    >
      {children}
      {active && (
        <span className="absolute inset-x-2 -bottom-[7px] h-0.5 rounded-full bg-amber-300 shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
      )}
      {badge != null && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-md ring-2 ring-blue-900">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
