"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendConversationMessage } from "@/lib/actions/conversation";

interface Person {
  id: string;
  name: string;
  username: string;
  role: string;
}
interface Msg {
  id: string;
  sender_id: string;
  body: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  created_at: string;
}

export default function ConversationView({
  conversationId,
  title,
  meId,
  meRole,
  participants,
  initialMessages,
}: {
  conversationId: string;
  title: string;
  meId: string;
  meRole: string;
  participants: Person[];
  initialMessages: Msg[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const nameById = useMemo(() => {
    const m = new Map<string, Person>();
    for (const p of participants) m.set(p.id, p);
    return m;
  }, [participants]);

  const teachers = participants.filter((p) => p.role === "teacher");
  const students = participants.filter((p) => p.role === "student");

  // 실시간 새 메시지 수신
  useEffect(() => {
    const ch = supabase
      .channel(`conv-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m],
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, conversationId]);

  // 첨부파일 서명 URL 생성 (비공개 버킷)
  useEffect(() => {
    const missing = messages.filter(
      (m) => m.attachment_path && !urls[m.attachment_path],
    );
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const m of missing) {
        const { data } = await supabase.storage
          .from("chat")
          .createSignedUrl(m.attachment_path!, 3600);
        if (data?.signedUrl) next[m.attachment_path!] = data.signedUrl;
      }
      if (!cancelled && Object.keys(next).length)
        setUrls((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, supabase, urls]);

  // 스크롤 최하단
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function refresh() {
    const { data } = await supabase
      .from("conversation_messages")
      .select(
        "id, sender_id, body, attachment_path, attachment_name, attachment_type, created_at",
      )
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as Msg[]);
  }

  async function onSend(file?: File) {
    setErr(null);
    const body = text.trim();
    if (!body && !file) return;
    setBusy(true);
    try {
      let att: {
        attachment_path?: string;
        attachment_name?: string;
        attachment_type?: string;
      } = {};
      if (file) {
        const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
        const path = `${conversationId}/${crypto.randomUUID()}${ext}`;
        const up = await supabase.storage
          .from("chat")
          .upload(path, file, { contentType: file.type || undefined });
        if (up.error) {
          setErr("파일 업로드 실패: " + up.error.message);
          setBusy(false);
          return;
        }
        att = {
          attachment_path: path,
          attachment_name: file.name,
          attachment_type: file.type || "application/octet-stream",
        };
      }
      const r = await sendConversationMessage({ conversationId, body, ...att });
      if (!r.ok) {
        setErr(r.error);
        setBusy(false);
        return;
      }
      setText("");
      if (fileRef.current) fileRef.current.value = "";
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white">
      {/* 헤더 — 제목(강좌명) + 참여자 */}
      <div className="border-b border-slate-200 px-4 py-3">
        <h1 className="text-base font-bold text-slate-800">{title}</h1>
        <div className="mt-1 flex flex-wrap gap-1 text-xs">
          {teachers.map((t) => (
            <span key={t.id} className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">
              {t.name}
            </span>
          ))}
          {students.map((s) => (
            <span key={s.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
              {s.name}
            </span>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          강사 {teachers.length}명 · 교육생 {students.length}명
        </p>
      </div>

      {/* 메시지 스레드 */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">
            아직 메시지가 없습니다. 첫 메시지를 보내보세요.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          const sender = nameById.get(m.sender_id);
          return (
            <div key={m.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
              <div className={"max-w-[78%] " + (mine ? "items-end text-right" : "items-start")}>
                {!mine && (
                  <div className="mb-0.5 text-xs font-medium text-slate-500">
                    {sender?.name ?? "알 수 없음"}
                    {sender?.role === "teacher" && " "}
                  </div>
                )}
                <div
                  className={
                    "inline-block rounded-2xl px-3 py-2 text-sm " +
                    (mine
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-800")
                  }
                >
                  {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                  {m.attachment_path && (
                    <Attachment
                      url={urls[m.attachment_path]}
                      name={m.attachment_name}
                      type={m.attachment_type}
                      mine={mine}
                    />
                  )}
                </div>
                <div className="mt-0.5 text-[10px] text-slate-400">
                  {new Date(m.created_at).toLocaleString("ko-KR", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 입력 */}
      <div className="border-t border-slate-200 p-3">
        {err && <p className="mb-2 text-xs text-red-600">{err}</p>}
        <div className="flex items-end gap-2">
          <label className="btn-ghost cursor-pointer whitespace-nowrap text-xs" title="이미지·PDF·Word·음성 파일 첨부">
            파일
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onSend(f);
              }}
            />
          </label>
          <textarea
            className="input min-h-[42px] flex-1 resize-none"
            placeholder="메시지를 입력하세요…"
            value={text}
            disabled={busy}
            rows={1}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <button
            className="btn whitespace-nowrap"
            disabled={busy || !text.trim()}
            onClick={() => onSend()}
          >
            {busy ? "전송 중…" : "전송"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Attachment({
  url,
  name,
  type,
  mine,
}: {
  url?: string;
  name: string | null;
  type: string | null;
  mine: boolean;
}) {
  if (!url) {
    return <div className="mt-1 text-xs opacity-70">{name ?? "첨부파일"} (불러오는 중…)</div>;
  }
  if (type?.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name ?? "image"} className="max-h-60 rounded-lg" />
      </a>
    );
  }
  if (type?.startsWith("audio/")) {
    return (
      <audio controls src={url} className="mt-1 w-56 max-w-full">
        오디오
      </audio>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={name ?? undefined}
      className={"mt-1 flex items-center gap-1 underline " + (mine ? "text-white" : "text-brand-700")}
    >
      {name ?? "파일 다운로드"}
    </a>
  );
}
