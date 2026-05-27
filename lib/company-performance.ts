// Aggregate company-level performance for a given month.
// Per session index within the month:
//   - avg overall feedback score (avg of all 10 leaf ratings)
//   - min, max across all students
//   - student count

import { createClient } from "@/lib/supabase/server";
import { FEEDBACK_KEYS } from "@/lib/types";

export interface CompanyPerformanceSession {
  sessionIndex: number;     // 1-based within the selected month
  avg: number;
  min: number;
  max: number;
  count: number;            // how many students had feedback at this session
  range: [number, number];  // [min, max] for recharts area
}

export interface CompanyPerformanceData {
  companyName: string;
  year: number;
  month: number;            // 1-12
  totalStudents: number;
  totalFeedback: number;
  sessions: CompanyPerformanceSession[];
}

function overallAvg(fb: Record<string, number | null>): number | null {
  const vals = FEEDBACK_KEYS.map((k) => fb[k]).filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return null;
  return vals.reduce((s, n) => s + n, 0) / vals.length;
}

export async function getCompanyPerformance(
  companyName: string,
  year: number,
  month: number      // 1-12
): Promise<CompanyPerformanceData> {
  const supabase = createClient();

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1); // exclusive
  const now = new Date();

  // 1) Students in this company
  const { data: students } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("role", "student")
    .eq("company_name", companyName);

  const studentIds = (students ?? []).map((s) => s.id);

  const empty: CompanyPerformanceData = {
    companyName, year, month,
    totalStudents: studentIds.length,
    totalFeedback: 0,
    sessions: [],
  };
  if (studentIds.length === 0) return empty;

  // 2) Confirmed bookings of these students in the month (start_at < now also acts as filter)
  const upperBound = monthEnd < now ? monthEnd : now;
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, student_id, start_at")
    .in("student_id", studentIds)
    .eq("status", "confirmed")
    .gte("start_at", monthStart.toISOString())
    .lt("start_at", upperBound.toISOString())
    .order("start_at", { ascending: true });

  const allBookings = bookings ?? [];
  if (allBookings.length === 0) return empty;

  // 3) Feedback for these bookings
  const bookingIds = allBookings.map((b) => b.id);
  const feedbackByBooking = new Map<string, any>();
  {
    const { data: fbs } = await supabase
      .from("feedback")
      .select("*")
      .in("booking_id", bookingIds);
    for (const f of fbs ?? []) feedbackByBooking.set(f.booking_id, f);
  }

  // 4) Group bookings by student, ordered chronologically → session index within month
  const byStudent = new Map<string, typeof allBookings>();
  for (const b of allBookings) {
    if (!byStudent.has(b.student_id)) byStudent.set(b.student_id, []);
    byStudent.get(b.student_id)!.push(b);
  }

  // 5) For each session index, collect overall scores across all students
  const scoresByIndex = new Map<number, number[]>();
  let totalFeedback = 0;

  for (const [, list] of byStudent) {
    list.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
    list.forEach((booking, i) => {
      const fb = feedbackByBooking.get(booking.id);
      if (!fb) return;
      const score = overallAvg(fb);
      if (score == null) return;
      const idx = i + 1;
      if (!scoresByIndex.has(idx)) scoresByIndex.set(idx, []);
      scoresByIndex.get(idx)!.push(score);
      totalFeedback++;
    });
  }

  // 6) Build session aggregates
  const sessions: CompanyPerformanceSession[] = Array.from(scoresByIndex.entries())
    .sort(([a], [b]) => a - b)
    .map(([sessionIndex, scores]) => {
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const avg = scores.reduce((s, n) => s + n, 0) / scores.length;
      return {
        sessionIndex,
        avg: Math.round(avg * 100) / 100,
        min: Math.round(min * 100) / 100,
        max: Math.round(max * 100) / 100,
        count: scores.length,
        range: [Math.round(min * 100) / 100, Math.round(max * 100) / 100],
      };
    });

  return {
    companyName, year, month,
    totalStudents: studentIds.length,
    totalFeedback,
    sessions,
  };
}
