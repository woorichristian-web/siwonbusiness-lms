"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * 본인 프로필 수정 — 본인이 직접 수정 가능한 필드만.
 * (role, username, admin_notes, assigned_teacher_id 등 관리자 전용 필드는 제외)
 */
export interface MyProfileInput {
  name?: string;
  birth_date?: string | null;
  phone?: string | null;
  residence_area?: string | null;
  company_name?: string;
  industry?: string | null;
  job_role?: string | null;
  learning_purpose?: string | null;
  preferred_format?: string[];
  preferred_time?: string[];
}

export async function updateMyProfile(input: MyProfileInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  if (input.name && input.name.trim().length === 0) {
    return { ok: false, error: "이름은 비울 수 없습니다." };
  }

  const patch: Record<string, any> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.birth_date !== undefined) patch.birth_date = input.birth_date || null;
  if (input.phone !== undefined) patch.phone = input.phone || null;
  if (input.residence_area !== undefined) patch.residence_area = input.residence_area || null;
  if (input.company_name !== undefined) patch.company_name = input.company_name?.trim() || null;
  if (input.industry !== undefined) patch.industry = input.industry || null;
  if (input.job_role !== undefined) patch.job_role = input.job_role || null;
  if (input.learning_purpose !== undefined) patch.learning_purpose = input.learning_purpose || null;
  if (input.preferred_format !== undefined) patch.preferred_format = input.preferred_format;
  if (input.preferred_time !== undefined) patch.preferred_time = input.preferred_time;

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/student/profile");
  revalidatePath("/student/status");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function changeMyPassword(newPassword: string) {
  if (newPassword.length < 8) {
    return { ok: false, error: "비밀번호는 8자 이상이어야 합니다." };
  }
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Teacher updates their own teachers row (bio/specialty/hourly_rate/bank info).
 * Only the logged-in teacher can update their own record.
 */
export interface MyTeacherInput {
  bio?: string | null;
  specialty?: string | null;
  hourly_rate?: number | null;
  bank_name?: string | null;
  bank_account?: string | null;
  account_holder?: string | null;
}

export async function updateMyTeacher(input: MyTeacherInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Login required." };

  // Upsert (creates teachers row if it doesn't exist yet)
  const { error } = await supabase
    .from("teachers")
    .upsert({ profile_id: user.id, ...input }, { onConflict: "profile_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/teacher/profile");
  return { ok: true };
}
