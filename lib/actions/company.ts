"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CompanySettings, ClassFormat, ClassType } from "@/lib/types";

async function assertAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("관리자 권한이 필요합니다.");
}

/** 기업별 설정 upsert (insert or update) */
export async function upsertCompanySettings(input: {
  company_name: string;
  allowed_class_types: ClassType[];
  allowed_formats: ClassFormat[];
  allowed_teacher_ids: string[];
  total_sessions: number | null;
  center_managed_registration: boolean;
}) {
  try { await assertAdmin(); }
  catch (e: any) { return { ok: false, error: e.message }; }

  const admin = createAdminClient();
  const { error } = await admin
    .from("company_settings")
    .upsert(
      {
        ...input,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_name" }
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/companies");
  revalidatePath("/student/calendar");
  revalidatePath("/student/register");
  return { ok: true };
}

/** 기업 휴일 추가 */
export async function addHoliday(input: {
  company_name: string;
  holiday_date: string;
  reason?: string;
}) {
  try { await assertAdmin(); }
  catch (e: any) { return { ok: false, error: e.message }; }

  const admin = createAdminClient();
  const { error } = await admin.from("company_holidays").insert({
    company_name: input.company_name,
    holiday_date: input.holiday_date,
    reason: input.reason || null,
  });
  if (error) {
    if (error.message.toLowerCase().includes("unique"))
      return { ok: false, error: "이미 등록된 휴일입니다." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/admin/companies");
  revalidatePath("/student/calendar");
  return { ok: true };
}

export async function deleteHoliday(id: string) {
  try { await assertAdmin(); }
  catch (e: any) { return { ok: false, error: e.message }; }

  const admin = createAdminClient();
  const { error } = await admin.from("company_holidays").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/companies");
  revalidatePath("/student/calendar");
  return { ok: true };
}

/**
 * 기업 삭제 — 이 회사의 과정(예약·시간표·대화방 포함), 소속 교육생 계정,
 * 기업 설정·휴일을 모두 삭제한다. 복원 불가.
 */
export async function deleteCompany(companyName: string) {
  try { await assertAdmin(); }
  catch (e: any) { return { ok: false as const, error: e.message }; }
  if (!companyName) return { ok: false as const, error: "회사명이 없습니다." };

  const admin = createAdminClient();

  // 1) 이 회사의 과정 삭제 (예약 → 시간표 → 과정; 배정·커리큘럼·대화방은 FK cascade)
  const { data: cs } = await admin
    .from("courses").select("id").eq("company_name", companyName);
  const courseIds = (cs ?? []).map((c: any) => c.id);
  if (courseIds.length > 0) {
    await admin.from("bookings").delete().in("course_id", courseIds);
    await admin.from("time_slots").delete().in("course_id", courseIds);
    const { error: ce } = await admin.from("courses").delete().in("id", courseIds);
    if (ce) return { ok: false as const, error: `과정 삭제 실패: ${ce.message}` };
  }

  // 2) 소속 교육생 계정 삭제 (auth 계정 삭제 → profiles cascade)
  const { data: members } = await admin
    .from("profiles").select("id")
    .eq("role", "student").eq("company_name", companyName);
  for (const m of members ?? []) {
    // 다른 과정에 남아있을 수 있는 개별 예약 정리 후 계정 삭제
    await admin.from("bookings").delete().eq("student_id", m.id);
    const { error: ue } = await admin.auth.admin.deleteUser(m.id);
    if (ue) return { ok: false as const, error: `회원 삭제 실패: ${ue.message}` };
  }

  // 3) 기업 설정·휴일
  await admin.from("company_settings").delete().eq("company_name", companyName);
  await admin.from("company_holidays").delete().eq("company_name", companyName);

  revalidatePath("/admin/companies");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/users");
  return {
    ok: true as const,
    deletedMembers: (members ?? []).length,
    deletedCourses: courseIds.length,
  };
}

/** 개별 회원 정보 수정 (관리자 전용 필드들) */
export async function updateMemberAdminFields(
  profileId: string,
  patch: {
    phone?: string | null;
    admin_notes?: string | null;
    assigned_teacher_id?: string | null;
    name?: string;
    english_name?: string | null;
    residence_area?: string | null;
    company_name?: string;
    industry?: string | null;
    job_role?: string | null;
    course_name?: string | null;
    course_start_date?: string | null;
    course_end_date?: string | null;
    course_total_sessions?: number | null;
  }
) {
  try { await assertAdmin(); }
  catch (e: any) { return { ok: false, error: e.message }; }

  const admin = createAdminClient();
  // assigned_teacher_id 빈 문자열은 null 로
  const clean: any = { ...patch };
  if (clean.assigned_teacher_id === "") clean.assigned_teacher_id = null;
  const { error } = await admin.from("profiles").update(clean).eq("id", profileId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/companies");
  revalidatePath("/admin/users");
  return { ok: true };
}
