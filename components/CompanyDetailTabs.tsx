"use client";

import Link from "next/link";

type Tab = "course" | "performance";

export default function CompanyDetailTabs({
  companyName,
  current,
}: {
  companyName: string;
  current: Tab;
}) {
  const base = `/admin/companies/${encodeURIComponent(companyName)}`;

  return (
    <div className="mb-6 flex gap-1 border-b border-slate-200">
      <TabLink href={base} active={current === "course"}>
        📚 기업별 과정관리
      </TabLink>
      <TabLink href={`${base}?tab=performance`} active={current === "performance"}>
        📊 기업별 성과관리
      </TabLink>
    </div>
  );
}

function TabLink({
  href, active, children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition " +
        (active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-700")
      }
    >
      {children}
    </Link>
  );
}
