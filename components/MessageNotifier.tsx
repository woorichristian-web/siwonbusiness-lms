"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Toast {
  id: string;
  body: string;
  createdAt: number;
}

/**
 * Supabase Realtime 으로 새 메시지를 감지해서 우측 하단에 토스트로 표시.
 * 동시에 헤더 뱃지가 갱신되도록 router.refresh() 호출.
 */
export default function MessageNotifier({ userId }: { userId: string }) {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages-for-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const m = payload.new as any;
          setToasts((prev) => [
            ...prev,
            { id: m.id, body: m.body, createdAt: Date.now() },
          ]);
          // 헤더 뱃지 등을 새로고침
          router.refresh();

          // 브라우저 알림 권한이 있으면 시스템 알림도 함께
          if (typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "granted") {
              try {
                new Notification("Siwon Business — 새 메시지", { body: m.body });
              } catch {}
            }
          }
        }
      )
      .subscribe();

    // 첫 마운트 시 알림 권한 요청 (이미 처리됐다면 noop)
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, router]);

  // 5초 후 자동 제거
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 5000);
    return () => clearTimeout(timer);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto rounded-lg border border-brand-300 bg-white p-4 shadow-lg"
        >
          <div className="mb-1 flex items-center gap-2 text-sm font-bold text-brand-700">
            <span>💬</span>
            <span>새 메시지가 도착했습니다</span>
          </div>
          <p className="line-clamp-3 text-sm text-slate-700">{t.body}</p>
        </div>
      ))}
    </div>
  );
}
