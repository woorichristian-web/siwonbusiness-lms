"use client";

import { useState } from "react";

export interface SentGroup {
  key: string;
  body: string;
  created_at: string;
  /** 같은 과정 전체 발송이면 과정명 (그 외 null) */
  course_name: string | null;
  recipients: { name: string; read: boolean }[];
}

/**
 * 센터 보낸 메시지함 — 같은 시각·같은 내용으로 여러 명에게 나간 메시지는
 * 1건으로 묶어 표시. 과정 전체 발송이면 과정명을 보여주고,
 * 상세를 열면 받은 사람 명단(읽음 여부)이 보인다.
 */
export default function AdminSentList({ groups }: { groups: SentGroup[] }) {
  const [selected, setSelected] = useState<SentGroup | null>(null);

  if (groups.length === 0) {
    return <div className="card text-center text-sm text-slate-400">보낸 메시지가 없습니다.</div>;
  }

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">받는 사람</th>
              <th className="px-4 py-2">내용</th>
              <th className="px-4 py-2 w-28">보낸 시각</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groups.map((g) => (
              <tr key={g.key} onClick={() => setSelected(g)}
                className="cursor-pointer transition hover:bg-slate-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  {g.recipients.length > 1 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                        {g.course_name ? `${g.course_name}` : "단체 발송"}
                      </span>
                      <span className="text-xs text-slate-500">{g.recipients.length}명</span>
                    </span>
                  ) : (
                    <span className="font-medium text-slate-700">{g.recipients[0]?.name ?? "—"}</span>
                  )}
                </td>
                <td className="max-w-md truncate px-4 py-3 text-slate-600">{firstLine(g.body)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">
                  {new Date(g.created_at).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}{" "}
                  {new Date(g.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <header className="mb-3 border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                {selected.course_name ? `${selected.course_name}` : selected.recipients.length > 1 ? "단체 발송" : selected.recipients[0]?.name}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {new Date(selected.created_at).toLocaleString("ko-KR")} · {selected.recipients.length}명에게 발송
              </p>
            </header>

            <article className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {selected.body}
            </article>

            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
              <h4 className="mb-2 text-xs font-semibold text-slate-500">받은 사람 ({selected.recipients.length})</h4>
              <div className="flex flex-wrap gap-1.5">
                {selected.recipients.map((r, i) => (
                  <span key={i}
                    className={"rounded-full px-2.5 py-0.5 text-xs " +
                      (r.read ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600")}>
                    {r.name}{r.read ? " ✓" : ""}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-slate-400">✓ = 읽음</p>
            </div>

            <div className="mt-5 flex justify-end">
              <button className="btn-ghost" onClick={() => setSelected(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function firstLine(body: string) {
  const first = body.split("\n")[0];
  return first.length > 70 ? first.slice(0, 70) + "…" : first;
}
