"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Student saves/updates their feedback about a teacher (1 per pair).
 */
export async function saveStudentTeacherFeedback(input: {
  teacher_id: string;
  rating: number | null;
  comment: string | null;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  if (input.rating != null) {
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 10) {
      return { ok: false, error: "점수는 1~10 사이여야 합니다." };
    }
  }

  const { error } = await supabase
    .from("student_teacher_feedback")
    .upsert(
      {
        student_id: user.id,
        teacher_id: input.teacher_id,
        rating: input.rating,
        comment: input.comment?.trim() || null,
      },
      { onConflict: "student_id,teacher_id" }
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/student/status");
  revalidatePath("/student/profile");
  return { ok: true };
}
