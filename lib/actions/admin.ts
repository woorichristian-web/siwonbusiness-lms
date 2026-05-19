"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { usernameToEmail } from "@/lib/constants";
import type { Role, ClassFormat, ClassType } from "@/lib/types";

/** 현재 사용자가 admin 인지 검증. 아니면 throw. */
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

export interface NewUserInput {
  role: Role;
  name: string;
  username: string;
  password: string;
  birth_date?: string;
  phone?: string;
  residence_area?: string;
  company_name?: string;
  industry?: string;
  job_role?: string;
  learning_purpose?: string;
  preferred_format?: string[];
  // 수강 정보 (관리자가 직접 입력하는 경우만)
  assigned_teacher_id?: string | null;
  course_name?: string | null;
  course_start_date?: string | null;
  course_end_date?: string | null;
  course_total_sessions?: number | null;
}

/** 관리자가 새 사용자(교육생/강사/관리자) 생성. */
export async function adminCreateUser(input: NewUserInput) {
  try {
    await assertAdmin();
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
  if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(input.username))
    return { ok: false, error: "아이디 형식이 올바르지 않습니다." };
  if (input.password.length < 8)
    return { ok: false, error: "비밀번호는 8자 이상이어야 합니다." };

  const admin = createAdminClient();
  const email = usernameToEmail(input.username);

  // 1) Auth user 생성 (자동 확인)
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });
  if (authErr || !created.user)
    return { ok: false, error: authErr?.message ?? "사용자 생성 실패" };

  // 2) profile insert (수강 정보 포함)
  const { error: pErr } = await admin.from("profiles").insert({
    id: created.user.id,
    role: input.role,
    username: input.username.toLowerCase(),
    name: input.name,
    birth_date: input.birth_date || null,
    phone: input.phone || null,
    residence_area: input.residence_area || null,
    company_name: input.company_name || null,
    industry: input.industry || null,
    job_role: input.job_role || null,
    learning_purpose: input.learning_purpose || null,
    preferred_format: input.preferred_format ?? [],
    assigned_teacher_id: input.assigned_teacher_id ?? null,
    course_name: input.course_name ?? null,
    course_start_date: input.course_start_date ?? null,
    course_end_date: input.course_end_date ?? null,
    course_total_sessions: input.course_total_sessions ?? null,
  });

  if (pErr) {
    // 롤백: auth user 제거
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: pErr.message };
  }

  // 강사인 경우 teachers row 도 자동 생성
  if (input.role === "teacher") {
    await admin.from("teachers").insert({ profile_id: created.user.id });
  }

  revalidatePath("/admin/users");
  return { ok: true, userId: created.user.id };
}

export async function adminChangeRole(userId: string, role: Role) {
  try { await assertAdmin(); }
  catch (e: any) { return { ok: false, error: e.message }; }
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  if (role === "teacher") {
    await admin.from("teachers").upsert({ profile_id: userId });
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function adminDeleteUser(userId: string) {
  try { await assertAdmin(); }
  catch (e: any) { return { ok: false, error: e.message }; }
  const admin = createAdminClient();
  // profiles 는 cascade 로 같이 삭제됨 (auth.users → profiles FK on delete cascade)
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/users");
  return { ok: true };
}

// ---------------------------------------------------------------------
// 엑셀(또는 CSV) 기반 강사 시간표 일괄 업로드.
// 입력 row 형식:
//   { teacher_username, start_at, end_at, format, class_type, capacity }
// start_at/end_at 은 Excel datetime 또는 ISO 문자열.
// ---------------------------------------------------------------------
export interface SlotImportRow {
  teacher_username: string;
  start_at: string;
  end_at: string;
  format: ClassFormat;
  class_type: ClassType;
  capacity: number;
}

export interface StudentImportRow {
  username: string;
  password: string;
  name: string;
  birth_date?: string;
  phone?: string;
  residence_area?: string;
  company_name?: string;
  industry?: string;
  job_role?: string;
  learning_purpose?: string;
  assigned_teacher_username?: string;
  // 수강 정보
  course_name?: string;
  course_start_date?: string;
  course_end_date?: string;
  course_total_sessions?: string | number;
  /** "/" 로 구분된 수강 일정. 예: "2026-06-01 09:00 / 2026-06-08 10:00" */
  schedule?: string;
}

export interface StudentImportResult {
  created: number;
  bookings_created: number;
  errors: Array<{ row: number; reason: string }>;
}

export interface ImportResult {
  inserted: number;
  errors: Array<{ row: number; reason: string }>;
}

export async function adminBulkUploadSlots(rows: SlotImportRow[]): Promise<{ ok: true; result: ImportResult } | { ok: false; error: string }> {
  try { await assertAdmin(); }
  catch (e: any) { return { ok: false, error: e.message }; }

  const admin = createAdminClient();
  const result: ImportResult = { inserted: 0, errors: [] };

  // username → teacher_id 매핑을 한 번에 조회
  const usernames = Array.from(new Set(rows.map((r) => r.teacher_username?.toLowerCase()).filter(Boolean)));
  const { data: teachers } = await admin
    .from("profiles")
    .select("id, username")
    .in("username", usernames)
    .eq("role", "teacher");
  const usernameToId: Record<string, string> = {};
  for (const t of teachers ?? []) usernameToId[t.username] = t.id;

  const inserts: any[] = [];
  rows.forEach((r, i) => {
    const tid = usernameToId[r.teacher_username?.toLowerCase()];
    if (!tid) {
      result.errors.push({ row: i + 2, reason: `강사 아이디(${r.teacher_username})를 찾을 수 없음` });
      return;
    }
    if (!r.start_at || !r.end_at) {
      result.errors.push({ row: i + 2, reason: "시작/종료 시간 누락" });
      return;
    }
    if (!["online", "offline"].includes(r.format)) {
      result.errors.push({ row: i + 2, reason: `format 값 오류 (${r.format})` });
      return;
    }
    if (!["1on1", "small_group"].includes(r.class_type)) {
      result.errors.push({ row: i + 2, reason: `class_type 값 오류 (${r.class_type})` });
      return;
    }
    inserts.push({
      teacher_id: tid,
      start_at: new Date(r.start_at).toISOString(),
      end_at: new Date(r.end_at).toISOString(),
      format: r.format,
      class_type: r.class_type,
      capacity: Number(r.capacity) || 1,
      status: "open",
    });
  });

  if (inserts.length > 0) {
    const { error } = await admin.from("time_slots").insert(inserts);
    if (error) return { ok: false, error: error.message };
    result.inserted = inserts.length;
  }

  revalidatePath("/admin/upload");
  revalidatePath("/student/calendar");
  return { ok: true, result };
}

// =====================================================================
// 교육생 일괄 업로드 — 계정 + 배정 강사 + 사전 예약(수강일정)을 한 번에
// =====================================================================
export async function adminBulkUploadStudents(
  rows: StudentImportRow[]
): Promise<{ ok: true; result: StudentImportResult } | { ok: false; error: string }> {
  try { await assertAdmin(); }
  catch (e: any) { return { ok: false, error: e.message }; }

  const admin = createAdminClient();
  const result: StudentImportResult = { created: 0, bookings_created: 0, errors: [] };

  // 행 단위로 처리 (한 행 실패해도 다음 행 계속)
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // 헤더 빼고 사람이 보는 행 번호

    // 1) 필수값 + 형식 검증
    if (!r.username || !r.password || !r.name) {
      result.errors.push({ row: rowNum, reason: "username, password, name 은 필수" });
      continue;
    }
    if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(r.username)) {
      result.errors.push({ row: rowNum, reason: `아이디 형식 오류 (${r.username})` });
      continue;
    }
    if (r.password.length < 8) {
      result.errors.push({ row: rowNum, reason: "비밀번호는 8자 이상" });
      continue;
    }

    // 2) 배정 강사 조회 (있으면)
    let assignedTeacherId: string | null = null;
    if (r.assigned_teacher_username) {
      const { data: t } = await admin
        .from("profiles")
        .select("id")
        .eq("username", r.assigned_teacher_username.toLowerCase())
        .eq("role", "teacher")
        .maybeSingle();
      if (!t) {
        result.errors.push({
          row: rowNum,
          reason: `배정 강사 아이디 '${r.assigned_teacher_username}' 를 찾을 수 없음`
        });
        continue;
      }
      assignedTeacherId = t.id;
    }

    // 3) Auth 계정 생성
    const email = usernameToEmail(r.username);
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: r.password,
      email_confirm: true,
    });
    if (authErr || !created.user) {
      result.errors.push({
        row: rowNum,
        reason: authErr?.message?.toLowerCase().includes("already")
          ? `이미 사용 중인 아이디 (${r.username})`
          : authErr?.message ?? "계정 생성 실패",
      });
      continue;
    }
    const userId = created.user.id;

    // 4) profile insert (수강 정보 포함)
    const totalSessions =
      r.course_total_sessions != null && String(r.course_total_sessions).trim() !== ""
        ? Number(r.course_total_sessions)
        : null;

    const { error: pErr } = await admin.from("profiles").insert({
      id: userId,
      role: "student",
      username: r.username.toLowerCase(),
      name: r.name.trim(),
      birth_date: r.birth_date || null,
      phone: r.phone || null,
      residence_area: r.residence_area || null,
      company_name: r.company_name || null,
      industry: r.industry || null,
      job_role: r.job_role || null,
      learning_purpose: r.learning_purpose || null,
      assigned_teacher_id: assignedTeacherId,
      course_name: r.course_name || null,
      course_start_date: r.course_start_date || null,
      course_end_date: r.course_end_date || null,
      course_total_sessions: Number.isFinite(totalSessions as number) ? totalSessions : null,
    });
    if (pErr) {
      // 롤백
      await admin.auth.admin.deleteUser(userId);
      result.errors.push({ row: rowNum, reason: "프로필 저장 실패: " + pErr.message });
      continue;
    }
    result.created++;

    // 5) 수강 일정이 있으면 사전 예약 생성
    if (r.schedule && assignedTeacherId) {
      const parts = r.schedule.split("/").map((s) => s.trim()).filter(Boolean);
      for (const part of parts) {
        const startAt = parseDate(part);
        if (!startAt) {
          result.errors.push({ row: rowNum, reason: `수강일정 파싱 실패: '${part}'` });
          continue;
        }

        // 해당 시각을 포함하는 강사 가능시간 찾기
        const { data: slot } = await admin
          .from("time_slots")
          .select("id, start_at, end_at, capacity, slot_duration_minutes")
          .eq("teacher_id", assignedTeacherId)
          .lte("start_at", startAt.toISOString())
          .gte("end_at", startAt.toISOString())
          .maybeSingle();
        if (!slot) {
          result.errors.push({
            row: rowNum,
            reason: `'${part}' 에 해당하는 강사 가능시간이 없음`,
          });
          continue;
        }

        // 슬롯 경계 정렬 확인
        const slotStart = new Date(slot.start_at).getTime();
        const fromStart = startAt.getTime() - slotStart;
        if (fromStart % (slot.slot_duration_minutes * 60000) !== 0) {
          result.errors.push({
            row: rowNum,
            reason: `'${part}' 가 ${slot.slot_duration_minutes}분 슬롯 경계에 안 맞음`,
          });
          continue;
        }

        const endAt = new Date(startAt.getTime() + slot.slot_duration_minutes * 60000);
        if (endAt > new Date(slot.end_at)) {
          result.errors.push({
            row: rowNum,
            reason: `'${part}' 가 강사 가능시간 범위를 벗어남`,
          });
          continue;
        }

        // 정원 체크
        const { count } = await admin
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("slot_id", slot.id)
          .eq("start_at", startAt.toISOString())
          .eq("status", "confirmed");
        if ((count ?? 0) >= slot.capacity) {
          result.errors.push({
            row: rowNum,
            reason: `'${part}' 정원 마감 (${slot.capacity}명)`,
          });
          continue;
        }

        const { error: bErr } = await admin.from("bookings").insert({
          slot_id: slot.id,
          student_id: userId,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          status: "confirmed",
        });
        if (bErr) {
          result.errors.push({ row: rowNum, reason: `예약 실패 '${part}': ${bErr.message}` });
          continue;
        }
        result.bookings_created++;
      }
    } else if (r.schedule && !assignedTeacherId) {
      result.errors.push({
        row: rowNum,
        reason: "수강일정이 있지만 배정 강사가 없음 — assigned_teacher_username 필요",
      });
    }
  }

  revalidatePath("/admin/upload");
  revalidatePath("/admin/companies");
  revalidatePath("/admin/users");
  return { ok: true, result };
}

// 헬퍼: "2026-06-01 09:00" 또는 ISO 문자열 → Date
function parseDate(s: string): Date | null {
  if (!s) return null;
  const candidate = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(candidate);
  return isNaN(d.getTime()) ? null : d;
}
