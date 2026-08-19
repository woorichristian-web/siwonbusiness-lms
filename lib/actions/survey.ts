"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { openRounds } from "@/lib/survey";

/** 한국어 코멘트를 영어로 번역 (ANTHROPIC_API_KEY 있을 때만). 실패 시 null. */
async function translateToEnglish(text: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !text.trim()) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `Translate the following Korean student feedback into natural English. Output ONLY the translation, nothing else. If it is already English, output it unchanged.\n\n${text}`,
        }],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const out = j?.content?.[0]?.text?.trim();
    return out || null;
  } catch {
    return null;
  }
}

/** 교육생 만족도 설문 제출 (1~10점 + 선택 코멘트). 응답 기간 내에만 가능. */
export async function submitSurvey(input: {
  courseId: string;
  round: 1 | 2 | 3;
  rating: number;
  comment?: string | null;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "로그인이 필요합니다." };
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 10)
    return { ok: false as const, error: "점수는 1~10 사이여야 합니다." };

  // 응답 기간 검증
  const { data: course } = await supabase
    .from("courses")
    .select("start_date, end_date")
    .eq("id", input.courseId)
    .maybeSingle();
  if (!course) return { ok: false as const, error: "과정을 찾을 수 없습니다." };
  const open = openRounds(course.start_date, course.end_date).find((r) => r.round === input.round);
  if (!open) return { ok: false as const, error: "지금은 이 설문의 응답 기간이 아닙니다." };

  const comment = input.comment?.trim() || null;
  const comment_en = comment ? await translateToEnglish(comment) : null;

  const { error } = await supabase.from("survey_responses").insert({
    course_id: input.courseId,
    student_id: user.id,
    round: input.round,
    rating: input.rating,
    comment,
    comment_en,
  });
  if (error) {
    if (error.code === "23505")
      return { ok: false as const, error: "이미 이 설문에 응답하셨습니다." };
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/**
 * 마감된 라운드의 익명 집계 (강사/센터 페이지 서버에서 호출).
 * 익명성을 위해 admin 클라이언트로 조회하고 이름은 반환하지 않는다.
 */
export async function getSurveyAggregate(courseId: string, round: number) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("survey_responses")
    .select("rating, comment, comment_en")
    .eq("course_id", courseId)
    .eq("round", round);
  const rows = data ?? [];
  const avg = rows.length
    ? Math.round((rows.reduce((s: number, r: any) => s + r.rating, 0) / rows.length) * 10) / 10
    : null;
  const comments = rows
    .map((r: any) => (r.comment_en || r.comment || "").trim())
    .filter(Boolean);
  return { count: rows.length, avg, comments };
}
