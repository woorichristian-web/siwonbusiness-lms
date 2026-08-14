"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CurriculumRow {
  session_no?: number | null;
  session_date?: string | null;
  topic?: string | null;
  details?: string | null;
  materials?: string | null;
}

/**
 * 과정 커리큘럼 업로드(전체 교체). 담당 강사 또는 관리자만 가능.
 * 완료 시 courses.curriculum_updated_at 갱신 + 센터(관리자)·수강 교육생에게 알림 메시지.
 */
export async function uploadCurriculum(courseId: string, rows: CurriculumRow[]) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "로그인이 필요합니다." };

  const { data: prof } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .single();
  const isAdmin = prof?.role === "admin";
  let allowed = isAdmin;
  if (!allowed) {
    const { data: ct } = await supabase
      .from("course_teachers")
      .select("id")
      .eq("course_id", courseId)
      .eq("teacher_id", user.id)
      .is("assigned_until", null)
      .maybeSingle();
    allowed = !!ct;
  }
  if (!allowed)
    return { ok: false as const, error: "이 과정의 담당 강사만 업로드할 수 있습니다." };

  const admin = createAdminClient();

  // 전체 교체
  await admin.from("course_curriculum").delete().eq("course_id", courseId);
  const insertRows = rows
    .filter((r) => r.session_no != null || r.topic || r.details || r.materials || r.session_date)
    .map((r, i) => ({
      course_id: courseId,
      session_no: r.session_no ?? null,
      session_date: r.session_date || null,
      topic: r.topic || null,
      details: r.details || null,
      materials: r.materials || null,
      sort_order: i,
    }));
  if (insertRows.length > 0) {
    const { error } = await admin.from("course_curriculum").insert(insertRows);
    if (error) return { ok: false as const, error: error.message };
  }
  await admin
    .from("courses")
    .update({ curriculum_updated_at: new Date().toISOString() })
    .eq("id", courseId);

  // 알림 — 관리자 + 수강 교육생
  const { data: course } = await admin.from("courses").select("name").eq("id", courseId).single();
  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
  const { data: enrolled } = await admin
    .from("course_students")
    .select("student_id")
    .eq("course_id", courseId);
  const recipients = new Set<string>();
  for (const a of admins ?? []) if (a.id !== user.id) recipients.add(a.id);
  for (const e of enrolled ?? []) recipients.add(e.student_id);
  if (recipients.size > 0) {
    const body = `[커리큘럼 업데이트] '${course?.name ?? "과정"}' 커리큘럼이 업데이트되었습니다. (${prof?.name ?? "강사"})`;
    await admin
      .from("messages")
      .insert([...recipients].map((rid) => ({ sender_id: user.id, recipient_id: rid, body })));
  }

  revalidatePath("/teacher/class-manage");
  revalidatePath("/student/status");
  revalidatePath("/admin/courses");
  return { ok: true as const, count: insertRows.length };
}
