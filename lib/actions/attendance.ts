"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/lib/types";

/**
 * Teacher (or admin) marks attendance for a booking.
 * Upserts so re-marking just overwrites.
 */
export async function markAttendance(
  bookingId: string,
  status: AttendanceStatus,
  notes?: string
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  // notes 파라미터가 없으면(상태만 변경) 기존 메모를 보존한다.
  let finalNotes: string | null = notes?.trim() || null;
  if (notes === undefined) {
    const { data: cur } = await supabase
      .from("attendance")
      .select("notes")
      .eq("booking_id", bookingId)
      .maybeSingle();
    finalNotes = cur?.notes ?? null;
  }

  const { error } = await supabase
    .from("attendance")
    .upsert(
      {
        booking_id: bookingId,
        status,
        marked_by: user.id,
        marked_at: new Date().toISOString(),
        notes: finalNotes,
      },
      { onConflict: "booking_id" }
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/teacher/schedule");
  revalidatePath("/student/status");
  return { ok: true };
}

/** Remove an attendance record (return to unmarked state). */
export async function clearAttendance(bookingId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("booking_id", bookingId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher/schedule");
  revalidatePath("/student/status");
  return { ok: true };
}
