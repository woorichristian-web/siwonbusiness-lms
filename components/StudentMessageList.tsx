"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Message } from "@/lib/types";
import { markMessageRead, markAllMessagesRead } from "@/lib/actions/message";

/**
 * Inbox displayed as a board-style list:
 *   - rows show sender + 1-line preview + time
 *   - clicking a row marks it read AND opens a modal with the full body
 */
export default function StudentMessageList({
  messages,
  senderInfo,
}: {
  messages: Message[];
  senderInfo: Record<string, { name: string; role: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Message | null>(null);
  const unreadCount = messages.filter((m) => !m.read_at).length;

  function openMessage(m: Message) {
    setSelected(m);
    if (!m.read_at) {
      startTransition(async () => {
        await markMessageRead(m.id);
        router.refresh();
      });
    }
  }

  function markAll() {
    if (unreadCount === 0) return;
    startTransition(async () => {
      await markAllMessagesRead();
      router.refresh();
    });
  }

  if (messages.length === 0) {
    return (
      <div className="card text-center text-slate-400">아직 받은 메시지가 없습니다.</div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-slate-500">
          전체 {messages.length}건 · <b className="text-amber-600">안 읽음 {unreadCount}건</b>
        </span>
        {unreadCount > 0 && (
          <button className="btn-ghost text-xs" onClick={markAll} disabled={pending}>
            모두 읽음 처리
          </button>
        )}
      </div>

      {/* 게시판 스타일 리스트 */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 w-12"></th>
              <th className="px-4 py-2">보낸 사람</th>
              <th className="px-4 py-2">내용</th>
              <th className="px-4 py-2 w-24">시각</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {messages.map((m) => {
              const sender = senderInfo[m.sender_id];
              const isUnread = !m.read_at;
              return (
                <tr
                  key={m.id}
                  onClick={() => openMessage(m)}
                  className={
                    "cursor-pointer transition hover:bg-slate-50 " +
                    (isUnread ? "bg-brand-50/40" : "")
                  }
                >
                  <td className="px-4 py-3 text-center">
                    {isUnread ? (
                      <span className="inline-block h-2 w-2 rounded-full bg-brand-600" />
                    ) : (
                      <span className="text-xs text-slate-300">읽음</span>
                    )}
                  </td>
                  <td className={"px-4 py-3 whitespace-nowrap " + (isUnread ? "font-semibold text-slate-800" : "text-slate-600")}>
                    {sender?.name ?? "—"}
                    <span className="ml-1 text-xs text-slate-400">
                      ({sender?.role === "teacher" ? "강사" : sender?.role === "admin" ? "관리자" : "교육생"})
                    </span>
                  </td>
                  <td className={"px-4 py-3 truncate max-w-md " + (isUnread ? "font-medium text-slate-800" : "text-slate-600")}>
                    {firstLine(m.body)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">
                    {relativeTime(m.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <MessageDetailModal
          message={selected}
          sender={senderInfo[selected.sender_id]}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function MessageDetailModal({
  message, sender, onClose,
}: {
  message: Message;
  sender?: { name: string; role: string };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
         onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <header className="mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">
              {sender?.name ?? "—"}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {sender?.role === "teacher" ? "강사" : sender?.role === "admin" ? "관리자" : "교육생"}
              </span>
            </h3>
            <span className="text-xs text-slate-400">
              {new Date(message.created_at).toLocaleString("ko-KR")}
            </span>
          </div>
        </header>

        <article className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {message.body}
        </article>

        {message.read_at && (
          <p className="mt-4 text-xs text-slate-400">
            읽음 시각: {new Date(message.read_at).toLocaleString("ko-KR")}
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <button className="btn-ghost" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

function firstLine(body: string) {
  const first = body.split("\n")[0];
  return first.length > 80 ? first.slice(0, 80) + "…" : first;
}

function relativeTime(iso: string) {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = (now - t) / 1000;
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  const days = Math.floor(diff / 86400);
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}
