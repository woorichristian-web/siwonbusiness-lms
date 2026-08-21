"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ClassFormat, ClassType, SlotStatus } from "@/lib/types";

interface SlotInput {
  start_at: string;
  end_at: string;
  format: ClassFormat;
  class_type: ClassType;
  capacity: number;
  slot_duration_minutes: 30 | 60;
  status?: SlotStatus;
}

/** 강사 본인 또는 관리자가 슬롯 생성. */
export async function createSlot(input: SlotInput, teacherId?: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  // teacherId 가 주어지지 않으면 본인 = 강사로 가정.
  const tid = teacherId ?? user.id;

  if (new Date(input.end_at) <= new Date(input.start_at)) {
    return { ok: false, error: "종료 시간이 시작 시간보다 앞섭니다." };
  }

  // 센터가 과정을 배정한 강사는 본인이 직접 availability 를 만들 수 없다
  // (관리자가 대신 만드는 경우는 허용).
  if (!teacherId || teacherId === user.id) {
    const { data: me } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (me?.role === "teacher") {
      const { count } = await supabase
        .from("course_teachers")
        .select("course_id", { count: "exact", head: true })
        .eq("teacher_id", user.id)
        .is("assigned_until", null);
      if ((count ?? 0) > 0) {
        return { ok: false, error: "Your schedule is assigned by the center — availability input is disabled. Please contact the center (b2b@siwonschool.com)." };
      }
    }
  }

  const { error } = await supabase.from("time_slots").insert({
    teacher_id: tid,
    start_at: input.start_at,
    end_at: input.end_at,
    format: input.format,
    class_type: input.class_type,
    capacity: input.capacity,
    slot_duration_minutes: input.slot_duration_minutes,
    status: input.status ?? "open",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/teacher/schedule");
  revalidatePath("/student/calendar");
  revalidatePath("/admin");
  return { ok: true };
}

export async function updateSlot(
  id: string,
  patch: Partial<SlotInput & { status: SlotStatus }>
) {
  const supabase = createClient();
  const { error } = await supabase.from("time_slots").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher/schedule");
  revalidatePath("/student/calendar");
  return { ok: true };
}

export async function deleteSlot(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("time_slots").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher/schedule");
  revalidatePath("/student/calendar");
  return { ok: true };
}
