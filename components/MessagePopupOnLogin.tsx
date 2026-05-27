"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface UnreadMsg {
  id: string;
  body: string;
  created_at: string;
  sender_name: string;
  sender_role: string;
}

/**
 * Login/session popup that lists unread messages once per session.
 * - Renders a modal if there are unread messages and user hasn't dismissed it.
 * - Uses sessionStorage to avoid showing twice in the same session.
 */
export default function MessagePopupOnLogin({
  unreadMessages,
  inboxHref,
  isTeacher,
}: {
  unreadMessages: UnreadMsg[];
  inboxHref: string;
  isTeacher: boolean;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (unreadMessages.length === 0) return;
    // 세션당 1회만 표시
    const key = "message_popup_dismissed";
    if (typeof window === "undefined") return;
    const dismissed = sessionStorage.getItem(key);
    if (!dismissed) setVisible(true);
  }, [unreadMessages.length]);

  function dismiss() {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("message_popup_dismissed", "1");
    }
    setVisible(false);
  }

  if (!visible) return null;

  const t = isTeacher
    ? {
        title: "📬 You have unread messages",
        sub: (n: number) => `${n} new message${n === 1 ? "" : "s"} waiting for you.`,
        go: "Open inbox",
        later: "Later",
        from: "From",
      }
    : {
        title: "📬 안 읽은 메시지가 있습니다",
        sub: (n: number) => `새 메시지 ${n}건이 기다리고 있어요.`,
        go: "메시지함 열기",
        later: "나중에 보기",
        from: "보낸 사람",
      };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={dismiss}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl"
      >
        <header className="mb-3">
          <h3 className="text-lg font-bold text-slate-800">{t.title}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{t.sub(unreadMessages.length)}</p>
        </header>

        <ul className="mb-5 max-h-64 space-y-2 overflow-y-auto">
          {unreadMessages.slice(0, 5).map((m) => (
            <li
              key={m.id}
              className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm"
            >
              <div className="mb-0.5 flex items-center justify-between">
                <span className="font-semibold text-slate-700">
                  {m.sender_name}
                  <span className="ml-1 text-xs font-normal text-slate-400">
                    ({m.sender_role === "teacher" ? "Teacher" : m.sender_role === "admin" ? "Admin" : "Student"})
                  </span>
                </span>
                <span className="text-xs text-slate-400">
                  {timeAgo(m.created_at, isTeacher)}
                </span>
              </div>
              <p className="line-clamp-2 text-slate-600">{m.body}</p>
            </li>
          ))}
          {unreadMessages.length > 5 && (
            <li className="text-center text-xs text-slate-400">
              ... and {unreadMessages.length - 5} more
            </li>
          )}
        </ul>

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={dismiss}>{t.later}</button>
          <Link href={inboxHref} onClick={dismiss} className="btn">{t.go}</Link>
        </div>
      </div>
    </div>
  );
}

function timeAgo(iso: string, english: boolean): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (english) {
    if (sec < 60) return "just now";
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  }
  if (sec < 60) return "방금 전";
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
}
