"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Tab = "course" | "performance";

export default function CompanyDetailTabs({
  companyName,
  current,
}: {
  companyName: string;
  current: Tab;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function switchTab(t: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    if (t === "course") {
      params.delete("tab");
      params.delete("month");
    } else {
      params.set("tab", "performance");
    }
    const q = params.toString();
    router.push(`/admin/companies/${encodeURIComponent(companyName)}${q ? `?${q}` : ""}`);
  }

  return (
    <div className="mb-6 flex gap-1 border-b border-slate-200">
      <TabBtn active={current === "course"} onClick={() => switchTab("course")}>
        📚 기업별 과정관리
      </TabBtn>
      <TabBtn active={current === "performance"} onClick={() => switchTab("performance")}>
        📊 기업별 성과관리
      </TabBtn>
    </div>
  );
}

function TabBtn({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition " +
        (active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-700")
      }
    >
      {children}
    </button>
  );
}
