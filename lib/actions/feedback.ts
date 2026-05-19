"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FeedbackInput, FeedbackKey } from "@/lib/types";
import { FEEDBACK_KEYS } from "@/lib/types";

/**
 * Teacher (or admin) saves per-class feedback for a booking.
 * Upserts on booking_id so re-submitting just overwrites.
 */
export async function saveFeedback(bookingId: string, input: FeedbackInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Login required." };

  // Build a clean payload — only known keys, validate 1-5 range or null
  const row: Record<string, any> = {
    booking_id: bookingId,
    created_by: user.id,
  };
  for (const k of FEEDBACK_KEYS) {
    const v = input[k];
    if (v == null || v === ("" as any)) {
      row[k] = null;
    } else {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 10) {
        return { ok: false, error: `Invalid rating for ${k}: must be 1-10.` };
      }
      row[k] = n;
    }
  }
  row.comment = input.comment?.trim() || null;

  const { error } = await supabase
    .from("feedback")
    .upsert(row, { onConflict: "booking_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/teacher/class-manage");
  revalidatePath("/teacher/schedule");
  revalidatePath("/student/status");
  return { ok: true };
}

export async function clearFeedback(bookingId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("feedback")
    .delete()
    .eq("booking_id", bookingId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher/class-manage");
  return { ok: true };
}
