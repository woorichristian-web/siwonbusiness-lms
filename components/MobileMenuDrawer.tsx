"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export type MobileMenuItem = {
  href: string;
  label: string;
  badge?: number;
};

export default function MobileMenuDrawer({
  items,
  userName,
  userRole,
  brandSubtitle,
  signOutLabel,
}: {
  items: MobileMenuItem[];
  userName: string;
  userRole: string;
  brandSubtitle: string;
  signOutLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 라우트가 바뀌면 자동으로 drawer 닫기
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // drawer 열려 있을 때 배경 스크롤 잠금
  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = original; };
    }
  }, [open]);

  return (
    <>
      {/* 햄버거 버튼 — 모바일에서만 표시 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-blue-100 transition hover:bg-white/10 hover:text-white sm:hidden"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Drawer 본체 */}
      {open && (
        <div className="fixed inset-0 z-[60] sm:hidden" role="dialog" aria-modal="true">
          {/* 어두운 배경 */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />

          {/* 사이드 패널 */}
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[82%] flex-col bg-gradient-to-b from-blue-900 via-blue-800 to-blue-900 text-blue-50 shadow-2xl">
            {/* 상단 골드 액센트 */}
            <div className="h-0.5 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400" />

            {/* 헤더 — 브랜드 + 닫기 */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
              <div className="min-w-0">
                <div className="truncate text-base font-bold text-white">Siwon Business</div>
                <div className="text-xs font-medium tracking-wide text-amber-300">
                  {brandSubtitle}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-blue-100 transition hover:bg-white/10 hover:text-white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>

            {/* 사용자 정보 */}
            <div className="border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold text-white">{userName}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-300">
                {userRole}
              </div>
            </div>

            {/* 네비게이션 */}
            <nav className="flex-1 overflow-y-auto p-2">
              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    item.href !== "/admin" &&
                    pathname?.startsWith(item.href)) ||
                  (item.href === "/admin" && pathname === "/admin");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={
                      "my-0.5 flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition " +
                      (active
                        ? "bg-white/15 text-white shadow-inner"
                        : "text-blue-100 hover:bg-white/10 hover:text-white")
                    }
                  >
                    <span>{item.label}</span>
                    {item.badge != null && item.badge > 0 && (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white shadow-md">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* 로그아웃 */}
            <div className="border-t border-white/10 p-3">
              <form action="/api/auth/signout" method="post">
                <button
                  type="submit"
                  className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-blue-50 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
                >
                  {signOutLabel}
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
