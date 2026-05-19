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

  const { error } = await supabase
    .from("attendance")
    .upsert(
      {
        booking_id: bookingId,
        status,
        marked_by: user.id,
        marked_at: new Date().toISOString(),
        notes: notes ?? null,
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
