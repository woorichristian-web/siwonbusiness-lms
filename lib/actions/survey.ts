"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { openRounds, surveyRounds, SURVEY_QUESTIONS } from "@/lib/survey";

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

/**
 * 교육생 만족도 설문 제출 — 객관식 10문항(5점 척도) + 주관식 2문항.
 * rating 컬럼에는 10점 환산 평균을 저장해 기존 집계·엑셀과 호환한다.
 * 응답 기간(주 시작 ~ 그 주 수업일+5일) 내에만 가능.
 */
export async function submitSurvey(input: {
  courseId: string;
  round: 1 | 2 | 3;
  answers: Record<string, number>;
  strengths?: string | null;
  improvements?: string | null;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "로그인이 필요합니다." };

  // 객관식 10문항 전부 1~5 정수인지 검증
  const vals: number[] = [];
  for (const q of SURVEY_QUESTIONS) {
    const v = input.answers?.[q.key];
    if (!Number.isInteger(v) || v < 1 || v > 5)
      return { ok: false as const, error: "모든 문항에 1~5점으로 응답해 주세요." };
    vals.push(v);
  }
  const avg5 = vals.reduce((a, b) => a + b, 0) / vals.length;
  const rating = Math.min(10, Math.max(1, Math.round(avg5 * 2))); // 10점 환산 (기존 호환)

  // 응답 기간 검증
  const { data: course } = await supabase
    .from("courses")
    .select("start_date, end_date, weekdays")
    .eq("id", input.courseId)
    .maybeSingle();
  if (!course) return { ok: false as const, error: "과정을 찾을 수 없습니다." };
  const open = openRounds(course.start_date, course.end_date, (course as any).weekdays ?? null)
    .find((r) => r.round === input.round);
  if (!open) return { ok: false as const, error: "지금은 이 설문의 응답 기간이 아닙니다." };

  const strengths = input.strengths?.trim() || null;
  const improvements = input.improvements?.trim() || null;
  // 기존 화면·엑셀 호환용 통합 코멘트
  const comment = [
    strengths ? `[만족한 점] ${strengths}` : null,
    improvements ? `[개선 요청] ${improvements}` : null,
  ].filter(Boolean).join("\n") || null;
  const comment_en = comment ? await translateToEnglish(comment) : null;

  const answers: Record<string, number> = {};
  for (const q of SURVEY_QUESTIONS) answers[q.key] = input.answers[q.key];

  let { error } = await supabase.from("survey_responses").insert({
    course_id: input.courseId,
    student_id: user.id,
    round: input.round,
    rating,
    comment,
    comment_en,
    answers,
    strengths,
    improvements,
  });
  // 0037 마이그레이션 미적용(컬럼 없음) 시 — 구버전 형식으로 저장
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    ({ error } = await supabase.from("survey_responses").insert({
      course_id: input.courseId,
      student_id: user.id,
      round: input.round,
      rating,
      comment,
      comment_en,
    }));
  }
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
    .select("name, code, company_name, start_date, end_date, weekdays")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return { ok: false as const, error: "과정을 찾을 수 없습니다." };

  let { data: rows } = await admin
    .from("survey_responses")
    .select("round, rating, comment, comment_en, created_at, student_id, answers, strengths, improvements")
    .eq("course_id", courseId)
    .order("created_at", { ascending: true });
  if (!rows) {
    // 0037 미적용 시 구버전 컬럼으로 재조회
    const fb = await admin
      .from("survey_responses")
      .select("round, rating, comment, comment_en, created_at, student_id")
      .eq("course_id", courseId)
      .order("created_at", { ascending: true });
    rows = (fb.data as any[] | null) ?? null;
  }

  const ids = Array.from(new Set((rows ?? []).map((r: any) => r.student_id)));
  const names = new Map<string, { name: string; username: string }>();
  if (ids.length > 0) {
    const { data: ps } = await admin
      .from("profiles").select("id, name, username").in("id", ids);
    for (const p of ps ?? []) names.set(p.id, { name: p.name, username: p.username });
  }

  // 교육생 → 담당 강사 매핑 (이 과정 예약이 가장 많은 강사 = 주 강사).
  // 한 과정을 여러 강사가 가르치는 경우 응답을 강사별로 구분하기 위함.
  const { data: bks } = await admin
    .from("bookings").select("student_id, slot_id").eq("course_id", courseId);
  const slotIds = Array.from(new Set((bks ?? []).map((b: any) => b.slot_id)));
  const slotTeacher = new Map<string, string>();
  if (slotIds.length > 0) {
    const { data: sl } = await admin
      .from("time_slots").select("id, teacher_id").in("id", slotIds);
    for (const s of sl ?? []) slotTeacher.set(s.id, s.teacher_id);
  }
  const perStudent = new Map<string, Map<string, number>>();
  for (const b of bks ?? []) {
    const t = slotTeacher.get(b.slot_id);
    if (!t) continue;
    if (!perStudent.has(b.student_id)) perStudent.set(b.student_id, new Map());
    const m = perStudent.get(b.student_id)!;
    m.set(t, (m.get(t) ?? 0) + 1);
  }
  const primaryTeacher = new Map<string, string>();
  for (const [sid, m] of perStudent)
    primaryTeacher.set(sid, Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0][0]);
  const tIds = Array.from(new Set(Array.from(primaryTeacher.values())));
  const tNames = new Map<string, string>();
  if (tIds.length > 0) {
    const { data: tp } = await admin.from("profiles").select("id, name").in("id", tIds);
    for (const p of tp ?? []) tNames.set(p.id, p.name);
  }

  const rounds = surveyRounds(course.start_date, course.end_date, (course as any).weekdays ?? null).map((r) => {
    const responses = (rows ?? [])
      .filter((x: any) => x.round === r.round)
      .map((x: any) => {
        const tid = primaryTeacher.get(x.student_id) ?? null;
        return {
          name: names.get(x.student_id)?.name ?? "(탈퇴한 회원)",
          username: names.get(x.student_id)?.username ?? "",
          teacher_id: tid,
          teacher_name: tid ? (tNames.get(tid) ?? "(알 수 없음)") : "미배정",
          rating: x.rating as number,
          comment: (x.comment ?? null) as string | null,
          comment_en: (x.comment_en ?? null) as string | null,
          answers: (x.answers ?? null) as Record<string, number> | null,
          strengths: (x.strengths ?? null) as string | null,
          improvements: (x.improvements ?? null) as string | null,
          created_at: x.created_at as string,
        };
      });
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

  // 엑셀 메타 (작성자·다운로드 날짜)
  const { data: meProfile } = await supabase
    .from("profiles").select("name").eq("id", user.id).single();
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const generatedAt = `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())} ${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;

  return {
    ok: true as const,
    courseName: course.name,
    courseCode: (course.code ?? null) as string | null,
    companyName: (course.company_name ?? null) as string | null,
    author: meProfile?.name ?? "관리자",
    generatedAt,
    rounds,
  };
}

/**
 * 마감된 라운드의 익명 집계 (강사/센터 페이지 서버에서 호출).
 * 익명성을 위해 admin 클라이언트로 조회하고 이름은 반환하지 않는다.
 */
export async function getSurveyAggregate(courseId: string, round: number) {
  const admin = createAdminClient();
  let { data } = await admin
    .from("survey_responses")
    .select("rating, comment, comment_en, answers")
    .eq("course_id", courseId)
    .eq("round", round);
  if (!data) {
    const fb = await admin
      .from("survey_responses")
      .select("rating, comment, comment_en")
      .eq("course_id", courseId)
      .eq("round", round);
    data = (fb.data as any[] | null) ?? null;
  }
  const rows = data ?? [];
  const avg = rows.length
    ? Math.round((rows.reduce((s: number, r: any) => s + r.rating, 0) / rows.length) * 10) / 10
    : null;
  const comments = rows
    .map((r: any) => (r.comment_en || r.comment || "").trim())
    .filter(Boolean);
  // 문항별 평균 (5점 만점) — 새 양식(answers) 응답이 있을 때만
  const qAvgs: Record<string, number> = {};
  let qCount = 0;
  for (const q of SURVEY_QUESTIONS) {
    const vals = rows
      .map((r: any) => r.answers?.[q.key])
      .filter((v: any): v is number => typeof v === "number");
    if (vals.length > 0) {
      qAvgs[q.key] = Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10;
      qCount++;
    }
  }
  return { count: rows.length, avg, comments, qAvgs: qCount > 0 ? qAvgs : null };
}
