"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** 여러 교육생에게 같은 메시지를 일괄 전송. */
export async function sendBulkMessage(recipientIds: string[], body: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  if (!body || body.trim().length === 0) {
    return { ok: false, error: "메시지를 입력하세요." };
  }
  if (body.length > 2000) {
    return { ok: false, error: "메시지가 너무 깁니다 (최대 2,000자)." };
  }
  const unique = Array.from(new Set(recipientIds.filter(Boolean)));
  if (unique.length === 0) return { ok: false, error: "받는 사람이 없습니다." };

  const rows = unique.map((rid) => ({
    sender_id: user.id,
    recipient_id: rid,
    body: body.trim(),
  }));

  const { error } = await supabase.from("messages").insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/student/messages");
  revalidatePath("/teacher/messages");
  return { ok: true, sent: rows.length };
}

/** 교육생에게 메시지 전송 (강사/관리자만 가능). */
export async function sendMessage(recipientId: string, body: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  if (!body || body.trim().length === 0) {
    return { ok: false, error: "메시지를 입력하세요." };
  }
  if (body.length > 2000) {
    return { ok: false, error: "메시지가 너무 깁니다 (최대 2,000자)." };
  }

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: recipientId,
    body: body.trim(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/student/messages");
  revalidatePath("/teacher/messages");
  return { ok: true };
}

/** 메시지를 읽음으로 표시 (본인이 받은 메시지만). */
export async function markMessageRead(messageId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("recipient_id", user.id)
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/student/messages");
  return { ok: true };
}

/** 모두 읽음 처리. */
export async function markAllMessagesRead() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/student/messages");
  return { ok: true };
}
