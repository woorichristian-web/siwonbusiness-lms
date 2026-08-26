"use client";

// 기업 삭제 버튼 — 회사명을 직접 입력해야 실행되는 이중 확인.
// 소속 교육생 계정·과정(예약·시간표·대화방)·설정·휴일이 모두 삭제된다.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCompany } from "@/lib/actions/company";

export default function CompanyDeleteButton({
  companyName,
  memberCount,
  courseCount,
}: {
  companyName: string;
  memberCount: number;
  courseCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    const typed = window.prompt(
      `[${companyName}] 기업을 삭제합니다.\n\n` +
        `- 소속 교육생 계정 ${memberCount}명\n` +
        `- 이 회사의 과정 ${courseCount}개 (예약·시간표·대화방 포함)\n` +
        `- 기업 설정·휴일\n\n` +
        `모두 영구 삭제되며 복원할 수 없습니다.\n` +
        `계속하려면 회사명을 정확히 입력하세요:`,
    );
    if (typed === null) return;
    if (typed.trim() !== companyName) {
      setError("회사명이 일치하지 않아 취소되었습니다.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteCompany(companyName);
      if (!res.ok) {
        setError(res.error ?? "삭제에 실패했습니다.");
        return;
      }
      router.replace("/admin/companies");
      router.refresh();
    });
  }

  return (
    <section className="mt-8 rounded-lg border border-red-200 bg-red-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-red-700">기업 삭제</h2>
          <p className="text-xs text-red-500">
            소속 교육생 계정 {memberCount}명과 과정 {courseCount}개(예약·시간표·대화방), 기업 설정·휴일이 모두 영구 삭제됩니다.
          </p>
          {error && <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "삭제 중..." : "기업 삭제"}
        </button>
      </div>
    </section>
  );
}
