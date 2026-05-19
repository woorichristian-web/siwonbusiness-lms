"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMessage, sendBulkMessage } from "@/lib/actions/message";

interface Student {
  id: string;
  name: string;
  username: string;
  company_name: string | null;
}

interface SentMessage {
  id: string;
  recipient_id: string;
  recipient_name: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

const T = {
  en: {
    recipient: "Recipient",
    selectPlaceholder: "Select a student",
    allStudents: "📢 All my students",
    noStudents: "No students have booked your classes yet.",
    bodyLabel: "Message (up to 2,000 characters)",
    bodyPlaceholder: "e.g. Please bring three business email samples to the next class.",
    sending: "Sending...",
    send: "Send message",
    sendToAll: "Send to all (broadcast)",
    sent: "Sent successfully.",
    sentToN: (n: number) => `Sent to ${n} student${n === 1 ? "" : "s"}.`,
    selectRecipient: "Please select a recipient.",
    emptyBody: "Please enter a message.",
    failed: "Failed to send",
    sentMessages: "Sent messages (last {n})",
    to: "→",
    read: "Read",
    unread: "Not read yet",
    confirmBroadcast: (n: number) => `Send this message to all ${n} students?`,
  },
  ko: {
    recipient: "받는 교육생",
    selectPlaceholder: "선택하세요",
    allStudents: "📢 내 모든 교육생",
    noStudents: "아직 본인 수업에 신청한 교육생이 없습니다.",
    bodyLabel: "메시지 내용 (최대 2,000자)",
    bodyPlaceholder: "예: 다음 수업 준비물은 비즈니스 이메일 샘플 3개입니다.",
    sending: "전송 중...",
    send: "메시지 보내기",
    sendToAll: "전체 발송",
    sent: "메시지를 전송했습니다.",
    sentToN: (n: number) => `${n}명에게 전송되었습니다.`,
    selectRecipient: "받는 사람을 선택하세요.",
    emptyBody: "메시지를 입력하세요.",
    failed: "전송 실패",
    sentMessages: "보낸 메시지 (최근 {n}건)",
    to: "→",
    read: "읽음",
    unread: "아직 읽지 않음",
    confirmBroadcast: (n: number) => `${n}명의 교육생 전체에게 이 메시지를 보낼까요?`,
  },
};

const ALL_VALUE = "__all__";

export default function TeacherMessageCompose({
  students,
  sent,
  english,
}: {
  students: Student[];
  sent: SentMessage[];
  english?: boolean;
}) {
  const router = useRouter();
  const t = english ? T.en : T.ko;
  const [pending, startTransition] = useTransition();
  const [recipientId, setRecipientId] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!recipientId) return setMsg({ type: "err", text: t.selectRecipient });
    if (!body.trim()) return setMsg({ type: "err", text: t.emptyBody });

    // 전체 발송
    if (recipientId === ALL_VALUE) {
      if (students.length === 0) return setMsg({ type: "err", text: t.noStudents });
      if (!confirm(t.confirmBroadcast(students.length))) return;
      startTransition(async () => {
        const r = await sendBulkMessage(students.map((s) => s.id), body);
        if (!r.ok) { setMsg({ type: "err", text: r.error ?? t.failed }); return; }
        setMsg({ type: "ok", text: t.sentToN(r.sent ?? students.length) });
        setBody("");
        router.refresh();
      });
      return;
    }

    startTransition(async () => {
      const r = await sendMessage(recipientId, body);
      if (!r.ok) { setMsg({ type: "err", text: r.error ?? t.failed }); return; }
      setMsg({ type: "ok", text: t.sent });
      setBody("");
      router.refresh();
    });
  }

  const dateLocale = english ? "en-US" : "ko-KR";

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card space-y-3">
        {msg && (
          <div className={
            "rounded-md border p-2 text-sm " +
            (msg.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700")
          }>{msg.text}</div>
        )}

        <div>
          <label className="label">{t.recipient}</label>
          <select className="input" value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}>
            <option value="">{t.selectPlaceholder}</option>
            {students.length > 0 && (
              <option value={ALL_VALUE}>
                {t.allStudents} ({students.length})
              </option>
            )}
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.username}){s.company_name ? ` · ${s.company_name}` : ""}
              </option>
            ))}
          </select>
          {students.length === 0 && (
            <p className="mt-1 text-xs text-slate-400">{t.noStudents}</p>
          )}
        </div>

        <div>
          <label className="label">{t.bodyLabel}</label>
          <textarea className="input min-h-[120px]" maxLength={2000}
            placeholder={t.bodyPlaceholder}
            value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="mt-1 text-right text-xs text-slate-400">{body.length} / 2,000</div>
        </div>

        <button type="submit" className="btn w-full" disabled={pending}>
          {pending ? t.sending : t.send}
        </button>
      </form>

      {sent.length > 0 && (
        <section className="card">
          <h2 className="mb-3 font-semibold">
            {t.sentMessages.replace("{n}", String(sent.length))}
          </h2>
          <ul className="space-y-2">
            {sent.map((m) => (
              <li key={m.id} className="rounded-md border border-slate-100 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium text-slate-700">{t.to} {m.recipient_name}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(m.created_at).toLocaleString(dateLocale)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-slate-600">{m.body}</p>
                <p className={"mt-1 text-xs " + (m.read_at ? "text-emerald-600" : "text-slate-400")}>
                  {m.read_at
                    ? `${t.read} · ${new Date(m.read_at).toLocaleString(dateLocale)}`
                    : t.unread}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
