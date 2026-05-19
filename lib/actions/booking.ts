"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * 교육생이 강사 가능시간(availability) 내의 특정 시각에 예약.
 * @param availabilityId  time_slots.id
 * @param startAtIso      예약 시작 시각 (정확히 슬롯 경계에 정렬되어야 함)
 */
export async function bookSlot(availabilityId: string, startAtIso: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  // 1) 가능시간 정보 가져오기
  const { data: slot, error: slotErr } = await supabase
    .from("time_slots")
    .select("id, start_at, end_at, capacity, status, slot_duration_minutes")
    .eq("id", availabilityId)
    .single();
  if (slotErr || !slot) return { ok: false, error: "수업을 찾을 수 없습니다." };
  if (slot.status !== "open") return { ok: false, error: "마감된 수업입니다." };

  const startAt = new Date(startAtIso);
  const endAt = new Date(startAt.getTime() + slot.slot_duration_minutes * 60 * 1000);
  const slotStart = new Date(slot.start_at);
  const slotEnd = new Date(slot.end_at);

  // 2-0) 이미 지난 시간 차단
  if (endAt <= new Date()) {
    return { ok: false, error: "이미 지난 시간은 신청할 수 없습니다." };
  }

  // 2-1) 교육생의 기업 설정·휴일·차시 검증
  const { data: me } = await supabase
    .from("profiles")
    .select("company_name")
    .eq("id", user.id)
    .single();

  if (me?.company_name) {
    const { data: cs } = await supabase
      .from("company_settings")
      .select("allowed_class_types, allowed_formats, allowed_teacher_ids, total_sessions")
      .eq("company_name", me.company_name)
      .maybeSingle();

    if (cs) {
      // 차시 한도
      if (cs.total_sessions != null) {
        const { count: doneCount } = await supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("student_id", user.id)
          .eq("status", "confirmed");
        if ((doneCount ?? 0) >= cs.total_sessions) {
          return { ok: false, error: `총 ${cs.total_sessions}차시 한도를 모두 사용했습니다.` };
        }
      }
      // 강사 화이트리스트
      const { data: teacherRow } = await supabase
        .from("time_slots")
        .select("teacher_id, format, class_type")
        .eq("id", availabilityId)
        .single();
      if (teacherRow) {
        if ((cs.allowed_teacher_ids?.length ?? 0) > 0
          && !cs.allowed_teacher_ids.includes(teacherRow.teacher_id)) {
          return { ok: false, error: "기업에서 허용한 강사가 아닙니다." };
        }
        if ((cs.allowed_formats?.length ?? 0) > 0
          && !cs.allowed_formats.includes(teacherRow.format)) {
          return { ok: false, error: "기업에서 허용한 진행 방식이 아닙니다." };
        }
        if ((cs.allowed_class_types?.length ?? 0) > 0
          && !cs.allowed_class_types.includes(teacherRow.class_type)) {
          return { ok: false, error: "기업에서 허용한 수업 형태가 아닙니다." };
        }
      }
    }

    // 휴일 차단
    const dateKey = `${startAt.getFullYear()}-${String(startAt.getMonth() + 1).padStart(2, "0")}-${String(startAt.getDate()).padStart(2, "0")}`;
    const { data: hol } = await supabase
      .from("company_holidays")
      .select("id")
      .eq("company_name", me.company_name)
      .eq("holiday_date", dateKey)
      .maybeSingle();
    if (hol) return { ok: false, error: "이 날은 기업 휴일로 지정되어 신청할 수 없습니다." };
  }

  // 2) 경계 검증: 가능시간 안에 들어와야 하고, 슬롯 길이 단위로 정렬되어야 함.
  if (startAt < slotStart || endAt > slotEnd) {
    return { ok: false, error: "선택한 시간이 강사 가능시간 범위를 벗어났습니다." };
  }
  const minutesFromStart = (startAt.getTime() - slotStart.getTime()) / 60000;
  if (minutesFromStart % slot.slot_duration_minutes !== 0) {
    return { ok: false, error: "슬롯 경계에 맞지 않는 시간입니다." };
  }

  // 3) 이 작은 칸에 이미 정원이 찼는지 확인
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("slot_id", availabilityId)
    .eq("start_at", startAt.toISOString())
    .eq("status", "confirmed");
  if ((count ?? 0) >= slot.capacity) {
    return { ok: false, error: "정원이 마감되었습니다." };
  }

  // 4) 본인이 이미 같은 칸을 예약했는지
  const { data: existing } = await supabase
    .from("bookings")
    .select("id")
    .eq("slot_id", availabilityId)
    .eq("student_id", user.id)
    .eq("start_at", startAt.toISOString())
    .eq("status", "confirmed")
    .maybeSingle();
  if (existing) return { ok: false, error: "이미 신청한 수업입니다." };

  const { error: insErr } = await supabase.from("bookings").insert({
    slot_id: availabilityId,
    student_id: user.id,
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    status: "confirmed",
  });
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/student/calendar");
  revalidatePath("/teacher/schedule");
  return { ok: true };
}

/** 교육생이 특정 가능시간·시각의 예약 취소. */
export async function cancelBooking(availabilityId: string, startAtIso: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("slot_id", availabilityId)
    .eq("student_id", user.id)
    .eq("start_at", new Date(startAtIso).toISOString())
    .eq("status", "confirmed");

  if (error) return { ok: false, error: error.message };

  revalidatePath("/student/calendar");
  revalidatePath("/teacher/schedule");
  return { ok: true };
}
