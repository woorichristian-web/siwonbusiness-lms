// Helper to fetch and compute a student's progress data (attendance + feedback)
// Used by teacher / admin / student progress reports.

import { createClient } from "@/lib/supabase/server";
import type { FeedbackKey } from "@/lib/types";
import { FEEDBACK_KEYS } from "@/lib/types";

export interface FeedbackPoint {
  date: string; // ISO date of the booking (start_at)
  scores: Partial<Record<FeedbackKey, number | null>>;
  avg: number | null;
}

export interface ProgressData {
  studentId: string;
  studentName: string;
  totalSessions: number | null;     // course_total_sessions (전체 차시)
  bookedCount: number;              // confirmed bookings (regardless of attendance)
  attendedCount: number;            // present + late
  absentCount: number;
  markedTotal: number;              // present + late + absent
  attendanceRate: number | null;    // 0~100
  feedbackPoints: FeedbackPoint[];
}

export async function getStudentProgress(studentId: string): Promise<ProgressData | null> {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, course_total_sessions")
    .eq("id", studentId)
    .maybeSingle();
  if (!profile) return null;

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, start_at, status")
    .eq("student_id", studentId)
    .order("start_at", { ascending: true });

  const confirmed = (bookings ?? []).filter((b: any) => b.status === "confirmed");
  const bookingIds = confirmed.map((b: any) => b.id);

  // Attendance
  const attMap = new Map<string, string>();
  if (bookingIds.length > 0) {
    const { data: atts } = await supabase
      .from("attendance")
      .select("booking_id, status")
      .in("booking_id", bookingIds);
    for (const a of atts ?? []) attMap.set(a.booking_id, a.status);
  }

  let attendedCount = 0, absentCount = 0;
  for (const b of confirmed) {
    const s = attMap.get(b.id);
    if (s === "present" || s === "late") attendedCount++;
    else if (s === "absent") absentCount++;
  }
  const markedTotal = attendedCount + absentCount;
  const attendanceRate = markedTotal === 0 ? null : Math.round((attendedCount / markedTotal) * 100);

  // Feedback
  const feedbackPoints: FeedbackPoint[] = [];
  if (bookingIds.length > 0) {
    const { data: fbs } = await supabase
      .from("feedback")
      .select("*")
      .in("booking_id", bookingIds);

    const fbByBooking = new Map<string, any>();
    for (const f of fbs ?? []) fbByBooking.set(f.booking_id, f);

    for (const b of confirmed) {
      const fb = fbByBooking.get(b.id);
      if (!fb) continue;
      const scores: Partial<Record<FeedbackKey, number | null>> = {};
      let sum = 0, n = 0;
      for (const k of FEEDBACK_KEYS) {
        const v = fb[k];
        scores[k] = (typeof v === "number") ? v : null;
        if (typeof v === "number") { sum += v; n++; }
      }
      feedbackPoints.push({
        date: b.start_at,
        scores,
        avg: n === 0 ? null : sum / n,
      });
    }
  }

  return {
    studentId: profile.id,
    studentName: profile.name,
    totalSessions: profile.course_total_sessions ?? null,
    bookedCount: confirmed.length,
    attendedCount,
    absentCount,
    markedTotal,
    attendanceRate,
    feedbackPoints,
  };
}
