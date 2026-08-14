"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  if (profile?.role !== "admin") throw new Error("관리자(센터) 권한이 필요합니다.");
  return supabase;
}

export interface CourseInput {
  code?: string | null;
  name: string;
  company_name?: string | null;
  language?: string | null;
  format?: "online" | "offline" | null;
  class_type?: "1on1" | "small_group" | null;
  capacity?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  weekdays?: string[];
  class_time?: string | null;
  duration_min?: number | null;
  total_sessions?: number | null;
}

function clean(input: CourseInput) {
  return {
    code: input.code?.trim() || null,
    name: input.name.trim(),
    company_name: input.company_name?.trim() || null,
    language: input.language?.trim() || null,
    format: input.format || null,
    class_type: input.class_type || null,
    capacity: input.capacity ?? null,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    weekdays: input.weekdays ?? [],
    class_time: input.class_time?.trim() || null,
    duration_min: input.duration_min ?? null,
    total_sessions: input.total_sessions ?? null,
  };
}

export async function createCourse(input: CourseInput) {
  let supabase;
  try { supabase = await assertAdmin(); }
  catch (e: any) { return { ok: false as const, error: e.message }; }
  if (!input.name?.trim()) return { ok: false as const, error: "강좌명은 필수입니다." };

  const { data, error } = await supabase
    .from("courses")
    .insert(clean(input))
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/courses");
  return { ok: true as const, courseId: data.id as string };
}

export async function updateCourse(courseId: string, input: CourseInput) {
  let supabase;
  try { supabase = await assertAdmin(); }
  catch (e: any) { return { ok: false as const, error: e.message }; }

  const { error } = await supabase
    .from("courses")
    .update({ ...clean(input), updated_at: new Date().toISOString() })
    .eq("id", courseId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true as const };
}

/** 강사 여러 명 배정 (이미 활성 배정된 강사는 건너뜀). */
export async function assignCourseTeachers(courseId: string, teacherIds: string[]) {
  let supabase;
  try { supabase = await assertAdmin(); }
  catch (e: any) { return { ok: false as const, error: e.message }; }
  if (teacherIds.length === 0) return { ok: true as const };

  const { data: existing } = await supabase
    .from("course_teachers")
    .select("teacher_id")
    .eq("course_id", courseId)
    .is("assigned_until", null);
  const already = new Set((existing ?? []).map((r: any) => r.teacher_id));
  const rows = teacherIds
    .filter((tid) => !already.has(tid))
    .map((tid) => ({ course_id: courseId, teacher_id: tid }));
  if (rows.length === 0) return { ok: true as const };

  const { error } = await supabase.from("course_teachers").insert(rows);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true as const };
}

/** 배정 강사 해제 (이력은 종료 처리로 보존). */
export async function removeCourseTeacher(courseId: string, teacherId: string) {
  let supabase;
  try { supabase = await assertAdmin(); }
  catch (e: any) { return { ok: false as const, error: e.message }; }

  const { error } = await supabase
    .from("course_teachers")
    .update({ assigned_until: new Date().toISOString().slice(0, 10), is_active: false })
    .eq("course_id", courseId)
    .eq("teacher_id", teacherId)
    .is("assigned_until", null);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true as const };
}

/**
 * 강사 교체 — 기존 강사(old)는 오늘부로 종료(이력·과거 데이터 보존),
 * 새 강사(new)를 오늘부터 배정. 이 과정의 '앞으로 예정된' 슬롯만 새 강사로 재배정.
 */
export async function replaceCourseTeacher(
  courseId: string,
  oldTeacherId: string,
  newTeacherId: string,
) {
  let supabase;
  try { supabase = await assertAdmin(); }
  catch (e: any) { return { ok: false as const, error: e.message }; }
  if (oldTeacherId === newTeacherId)
    return { ok: false as const, error: "같은 강사입니다." };

  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  // 1) 기존 배정 종료 + 교체 기록
  const { error: e1 } = await supabase
    .from("course_teachers")
    .update({ assigned_until: today, is_active: false, replaced_by: newTeacherId })
    .eq("course_id", courseId)
    .eq("teacher_id", oldTeacherId)
    .is("assigned_until", null);
  if (e1) return { ok: false as const, error: e1.message };

  // 2) 새 강사 배정
  const { error: e2 } = await supabase
    .from("course_teachers")
    .insert({ course_id: courseId, teacher_id: newTeacherId, assigned_from: today });
  if (e2) return { ok: false as const, error: e2.message };

  // 3) 이 과정의 '예정(미래)' 슬롯만 새 강사로 재배정 (과거 슬롯·데이터는 그대로)
  await supabase
    .from("time_slots")
    .update({ teacher_id: newTeacherId })
    .eq("course_id", courseId)
    .eq("teacher_id", oldTeacherId)
    .gte("start_at", nowIso);

  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true as const };
}
