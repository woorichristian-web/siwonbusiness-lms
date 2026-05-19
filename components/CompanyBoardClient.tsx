"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

interface CompanyRow {
  name: string;
  memberCount: number;
  courseCount: number;
  latestCourseDate: string | null;
}

export default function CompanyBoardClient({ companies }: { companies: CompanyRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [query, companies]);

  return (
    <div className="space-y-4">
      {/* 검색바 */}
      <div className="card flex items-center gap-2">
        <span aria-hidden className="text-slate-400">🔍</span>
        <input
          className="input flex-1"
          placeholder="기업명 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="text-xs text-slate-400">
          {filtered.length} / {companies.length} 개 기업
        </span>
      </div>

      {/* 게시판 */}
      {companies.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          아직 등록된 기업이 없습니다. 교육생이 가입하면 자동으로 목록에 추가됩니다.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          검색 결과가 없습니다.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">기업명</th>
                <th className="px-4 py-2 w-28 text-center">교육생 수</th>
                <th className="px-4 py-2 w-28 text-center">계약 강좌</th>
                <th className="px-4 py-2 w-36">최근 시작일</th>
                <th className="px-4 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.name} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/companies/${encodeURIComponent(c.name)}`}
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      🏢 {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700">{c.memberCount}명</td>
                  <td className="px-4 py-3 text-center text-slate-700">
                    {c.courseCount > 0 ? `${c.courseCount}개` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.latestCourseDate
                      ? new Date(c.latestCourseDate).toLocaleDateString("ko-KR")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/companies/${encodeURIComponent(c.name)}`}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      관리 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
