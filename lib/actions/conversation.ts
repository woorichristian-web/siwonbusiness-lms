"use server";

import { createClient } from "@/lib/supabase/server";

/** 대화방에 메시지 전송 (텍스트 + 선택적 첨부). RLS 로 참여자만 허용됨. */
export async function sendConversationMessage(input: {
  conversationId: string;
  body?: string;
  attachment_path?: string;
  attachment_name?: string;
  attachment_type?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const body = (input.body ?? "").trim();
  if (!body && !input.attachment_path)
    return { ok: false, error: "보낼 내용이 없습니다." };

  const { error } = await supabase.from("conversation_messages").insert({
    conversation_id: input.conversationId,
    sender_id: user.id,
    body: body || null,
    attachment_path: input.attachment_path ?? null,
    attachment_name: input.attachment_name ?? null,
    attachment_type: input.attachment_type ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
