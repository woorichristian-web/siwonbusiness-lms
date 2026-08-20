"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { openRounds, surveyRounds } from "@/lib/survey";

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
 * 센터(관리자) 전용 — 과정의 설문 응답 전체를 실명으로 조회.
 * 강사에게는 익명 집계만 전달되지만, 센터는 누가 어떤 점수·코멘트를
 * 남겼는지 라운드별로 모두 볼 수 있다.
 */
export async function getCourseSurveyAdmin(courseId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "로그인이 필요합니다." };
  const { data: me } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin")
    return { ok: false as const, error: "관리자(센터) 권한이 필요합니다." };

  const admin = createAdminClient();
  const { data: course } = await admin
    .from("courses")
    .select("name, start_date, end_date")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return { ok: false as const, error: "과정을 찾을 수 없습니다." };

  const { data: rows } = await admin
    .from("survey_responses")
    .select("round, rating, comment, comment_en, created_at, student_id")
    .eq("course_id", courseId)
    .order("created_at", { ascending: true });

  const ids = Array.from(new Set((rows ?? []).map((r: any) => r.student_id)));
  const names = new Map<string, { name: string; username: string }>();
  if (ids.length > 0) {
    const { data: ps } = await admin
      .from("profiles").select("id, name, username").in("id", ids);
    for (const p of ps ?? []) names.set(p.id, { name: p.name, username: p.username });
  }

  const rounds = surveyRounds(course.start_date, course.end_date).map((r) => {
    const responses = (rows ?? [])
      .filter((x: any) => x.round === r.round)
      .map((x: any) => ({
        name: names.get(x.student_id)?.name ?? "(탈퇴한 회원)",
        username: names.get(x.student_id)?.username ?? "",
        rating: x.rating as number,
        comment: (x.comment ?? null) as string | null,
        comment_en: (x.comment_en ?? null) as string | null,
        created_at: x.created_at as string,
      }));
    const avg = responses.length
      ? Math.round((responses.reduce((s, x) => s + x.rating, 0) / responses.length) * 10) / 10
      : null;
    return {
      round: r.round,
      label: r.label,
      open: r.open.toISOString(),
      close: r.close.toISOString(),
      avg,
      responses,
    };
  });

  return { ok: true as const, courseName: course.name, rounds };
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
