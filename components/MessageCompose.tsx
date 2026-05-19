"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMessage, sendBulkMessage } from "@/lib/actions/message";

export interface Recipient {
  id: string;
  name: string;
  sublabel?: string;     // 회사명, 강사, 관리자 등
}

export interface RecipientGroup {
  label: string;          // optgroup 라벨 (예: "관리자", "강사")
  recipients: Recipient[];
}

export interface BulkOption {
  value: string;          // 드롭다운에 표시할 고유 값 (예: "__all_students__")
  label: string;          // "📢 내 모든 교육생 (5)"
  ids: string[];          // 실제 받는 사람들 id 배열
  confirmText: string;    // confirm 다이얼로그 메시지
}

/**
 * 모든 역할이 공통으로 사용하는 메시지 작성 폼.
 * - 단일 수신자 또는 단체 발송(BulkOption) 지원
 * - 한국어 라벨 (필요 시 props 로 override)
 */
export default function MessageCompose({
  title,
  description,
  recipientLabel,
  placeholder,
  groups,
  bulkOptions = [],
  lang = "ko",
}: {
  title: string;
  description?: string;
  recipientLabel: string;
  placeholder: string;
  groups: RecipientGroup[];
  bulkOptions?: BulkOption[];
  lang?: "ko" | "en";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [recipientId, setRecipientId] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const t = lang === "en" ? {
    selectPlaceholder: "Select a recipient",
    sending: "Sending...",
    send: "Send message",
    sentOk: "Sent successfully.",
    sentMany: (n: number) => `Sent to ${n} recipient${n === 1 ? "" : "s"}.`,
    selectRecipient: "Please select a recipient.",
    emptyBody: "Please enter a message.",
    failed: "Failed to send",
  } : {
    selectPlaceholder: "선택하세요",
    sending: "전송 중...",
    send: "메시지 보내기",
    sentOk: "메시지를 전송했습니다.",
    sentMany: (n: number) => `${n}명에게 전송되었습니다.`,
    selectRecipient: "받는 사람을 선택하세요.",
    emptyBody: "메시지를 입력하세요.",
    failed: "전송 실패",
  };

  const totalRecipients = groups.reduce((sum, g) => sum + g.recipients.length, 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!recipientId) return setMsg({ type: "err", text: t.selectRecipient });
    if (!body.trim()) return setMsg({ type: "err", text: t.emptyBody });

    // 단체 발송 옵션인지 확인
    const bulk = bulkOptions.find((b) => b.value === recipientId);
    if (bulk) {
      if (!confirm(bulk.confirmText)) return;
      startTransition(async () => {
        const r = await sendBulkMessage(bulk.ids, body);
        if (!r.ok) { setMsg({ type: "err", text: r.error ?? t.failed }); return; }
        setMsg({ type: "ok", text: t.sentMany(r.sent ?? bulk.ids.length) });
        setBody("");
        router.refresh();
      });
      return;
    }

    startTransition(async () => {
      const r = await sendMessage(recipientId, body);
      if (!r.ok) { setMsg({ type: "err", text: r.error ?? t.failed }); return; }
      setMsg({ type: "ok", text: t.sentOk });
      setBody("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <header>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      </header>

      {msg && (
        <div className={
          "rounded-md border p-2 text-sm " +
          (msg.type === "ok"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700")
        }>{msg.text}</div>
      )}

      <div>
        <label className="label">{recipientLabel}</label>
        <select className="input" value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}>
          <option value="">{t.selectPlaceholder}</option>
          {bulkOptions.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
          {groups.map((g) =>
            g.recipients.length === 0 ? null : (
              <optgroup key={g.label} label={g.label}>
                {g.recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}{r.sublabel ? ` · ${r.sublabel}` : ""}
                  </option>
                ))}
              </optgroup>
            )
          )}
        </select>
        {totalRecipients === 0 && bulkOptions.length === 0 && (
          <p className="mt-1 text-xs text-slate-400">
            {lang === "en" ? "No recipients available." : "보낼 수 있는 대상이 없습니다."}
          </p>
        )}
      </div>

      <div>
        <label className="label">
          {lang === "en" ? "Message (up to 2,000 characters)" : "메시지 내용 (최대 2,000자)"}
        </label>
        <textarea className="input min-h-[120px]" maxLength={2000}
          placeholder={placeholder}
          value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="mt-1 text-right text-xs text-slate-400">{body.length} / 2,000</div>
      </div>

      <button type="submit" className="btn w-full" disabled={pending}>
        {pending ? t.sending : t.send}
      </button>
    </form>
  );
}
