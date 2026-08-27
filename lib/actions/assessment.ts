"use server";

// 강사의 교육생 스피킹 평가(Initial/Final) 저장.
// RLS: 해당 과정에 활성 배정된 강사와 관리자만 접근 가능 (0036).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ASSESSMENT_ITEM_KEYS, type AssessmentPhase } from "@/lib/assessment";

export async function saveTeacherAssessment(input: {
  course_id: string;
  student_id: string;
  phase: AssessmentPhase;
  scores: Record<string, number>;
  comment?: string | null;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "로그인이 필요합니다." };

  if (input.phase !== "initial" && input.phase !== "final")
    return { ok: false as const, error: "잘못된 평가 단계입니다." };

  // 정의된 영역 키 + 1~10 정수만 저장
  const scores: Record<string, number> = {};
  for (const k of ASSESSMENT_ITEM_KEYS) {
    const v = input.scores[k];
    if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 10) scores[k] = v;
  }

  const { error } = await supabase.from("teacher_assessments").upsert(
    {
      course_id: input.course_id,
      student_id: input.student_id,
      teacher_id: user.id,
      phase: input.phase,
      scores,
      comment: input.comment?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "course_id,student_id,phase" },
  );
  if (error) {
    if (/relation .*teacher_assessments.* does not exist/i.test(error.message))
      return { ok: false as const, error: "평가 테이블이 아직 없습니다. 관리자에게 0036 마이그레이션 적용을 요청하세요." };
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/teacher/class-manage");
  return { ok: true as const };
}
