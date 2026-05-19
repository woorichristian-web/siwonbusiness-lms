// Helper to compute aggregate report for a company+course.
// Used by /admin/companies/[name]/courses/[course] page.

import { createClient } from "@/lib/supabase/server";
import { FEEDBACK_KEYS, type FeedbackKey } from "@/lib/types";

export interface CourseReportData {
  companyName: string;
  courseName: string;
  studentCount: number;
  totalSessions: number | null;
  startDate: string | null;
  endDate: string | null;

  // Aggregate attendance
  totalConfirmed: number;
  totalAttended: number;     // present + late across all students
  totalAbsent: number;
  attendanceRate: number | null;

  // Initial vs Final test comparison
  // Per area: average across all students' first feedback vs last feedback
  areaComparison: Array<{
    area: string;
    label: string;
    color: string;
    initial: number | null;
    final: number | null;
    delta: number | null;
  }>;

  // Per-student summary (optional, useful for table)
  perStudent: Array<{
    studentId: string;
    studentName: string;
    initialAvg: number | null;
    finalAvg: number | null;
    delta: number | null;
    sessions: number;
    feedbackCount: number;
  }>;
}

// Area definitions (must match ProgressReport)
const AREAS: { key: string; label: string; color: string; leaves: FeedbackKey[] }[] = [
  { key: "grammar",       label: "Grammar",           color: "#1d4ed8", leaves: ["grammar_accuracy", "grammar_complexity"] },
  { key: "vocabulary",    label: "Vocabulary",        color: "#0891b2", leaves: ["vocabulary_diversity", "vocabulary_relevancy"] },
  { key: "comprehension", label: "Comprehension",     color: "#059669", leaves: ["comprehension"] },
  { key: "content",       label: "Content & Message", color: "#65a30d", leaves: ["content_clarity", "content_organization"] },
  { key: "attitude",      label: "Attitude",          color: "#dc2626", leaves: ["participation", "tone_manner", "preparation"] },
];

function leafAvg(scores: Record<string, number | null>, leaves: FeedbackKey[]): number | null {
  const vals = leaves.map((k) => scores[k]).filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return null;
  return vals.reduce((s, n) => s + n, 0) / vals.length;
}

function overallAvg(scores: Record<string, number | null>): number | null {
  const vals = FEEDBACK_KEYS.map((k) => scores[k]).filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return null;
  return vals.reduce((s, n) => s + n, 0) / vals.length;
}

export async function getCourseReport(
  companyName: string,
  courseName: string
): Promise<CourseReportData> {
  const supabase = createClient();

  // 1) Find students in this course
  const { data: studentRows } = await supabase
    .from("profiles")
    .select("id, name, course_total_sessions, course_start_date, course_end_date")
    .eq("company_name", companyName)
    .eq("course_name", courseName);

  const students = studentRows ?? [];
  const studentIds = students.map((s) => s.id);

  const result: CourseReportData = {
    companyName,
    courseName,
    studentCount: students.length,
    totalSessions: null,
    startDate: null,
    endDate: null,
    totalConfirmed: 0,
    totalAttended: 0,
    totalAbsent: 0,
    attendanceRate: null,
    areaComparison: AREAS.map((a) => ({
      area: a.key, label: a.label, color: a.color,
      initial: null, final: null, delta: null,
    })),
    perStudent: [],
  };

  if (studentIds.length === 0) return result;

  // Date range / total sessions across course
  const startDates = students.map((s) => s.course_start_date).filter(Boolean) as string[];
  const endDates = students.map((s) => s.course_end_date).filter(Boolean) as string[];
  const totals = students.map((s) => s.course_total_sessions).filter((v: any): v is number => typeof v === "number");
  result.startDate = startDates.length > 0 ? startDates.sort()[0] : null;
  result.endDate = endDates.length > 0 ? endDates.sort().slice(-1)[0] : null;
  result.totalSessions = totals.length > 0 ? Math.max(...totals) : null;

  // 2) Bookings
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, student_id, start_at, status")
    .in("student_id", studentIds)
    .eq("status", "confirmed")
    .order("start_at", { ascending: true });

  const allBookings = bookings ?? [];
  const bookingIds = allBookings.map((b: any) => b.id);
  const bookingsByStudent = new Map<string, any[]>();
  for (const b of allBookings) {
    if (!bookingsByStudent.has(b.student_id)) bookingsByStudent.set(b.student_id, []);
    bookingsByStudent.get(b.student_id)!.push(b);
  }
  result.totalConfirmed = allBookings.length;

  // 3) Attendance
  const attMap = new Map<string, string>();
  if (bookingIds.length > 0) {
    const { data: atts } = await supabase
      .from("attendance")
      .select("booking_id, status")
      .in("booking_id", bookingIds);
    for (const a of atts ?? []) attMap.set(a.booking_id, a.status);
  }

  for (const b of allBookings) {
    const s = attMap.get(b.id);
    if (s === "present" || s === "late") result.totalAttended++;
    else if (s === "absent") result.totalAbsent++;
  }
  const markedTotal = result.totalAttended + result.totalAbsent;
  result.attendanceRate = markedTotal === 0 ? null : Math.round((result.totalAttended / markedTotal) * 100);

  // 4) Feedback
  const fbsByBooking = new Map<string, any>();
  if (bookingIds.length > 0) {
    const { data: fbs } = await supabase
      .from("feedback")
      .select("*")
      .in("booking_id", bookingIds);
    for (const f of fbs ?? []) fbsByBooking.set(f.booking_id, f);
  }

  // For each student: find chronologically first and last feedback
  type AreaScores = Record<string, number | null>;
  const perStudent: { id: string; name: string; firstFb: AreaScores | null; lastFb: AreaScores | null; sessions: number; feedbackCount: number }[] = [];

  for (const s of students) {
    const sBookings = (bookingsByStudent.get(s.id) ?? []).sort(
      (a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );
    const feedbacks = sBookings
      .map((b: any) => fbsByBooking.get(b.id))
      .filter(Boolean);
    perStudent.push({
      id: s.id,
      name: s.name,
      firstFb: feedbacks[0] ?? null,
      lastFb: feedbacks.length > 1 ? feedbacks[feedbacks.length - 1] : null,
      sessions: sBookings.length,
      feedbackCount: feedbacks.length,
    });
  }

  // 5) Area comparison — average initial/final across students per area
  for (const area of AREAS) {
    const initials: number[] = [];
    const finals: number[] = [];
    for (const ps of perStudent) {
      if (ps.firstFb) {
        const v = leafAvg(ps.firstFb, area.leaves);
        if (v != null) initials.push(v);
      }
      if (ps.lastFb) {
        const v = leafAvg(ps.lastFb, area.leaves);
        if (v != null) finals.push(v);
      }
    }
    const initialAvg = initials.length === 0 ? null : initials.reduce((s, n) => s + n, 0) / initials.length;
    const finalAvg = finals.length === 0 ? null : finals.reduce((s, n) => s + n, 0) / finals.length;
    const entry = result.areaComparison.find((a) => a.area === area.key)!;
    entry.initial = initialAvg == null ? null : Math.round(initialAvg * 100) / 100;
    entry.final = finalAvg == null ? null : Math.round(finalAvg * 100) / 100;
    entry.delta = entry.initial != null && entry.final != null
      ? Math.round((entry.final - entry.initial) * 100) / 100
      : null;
  }

  // Per-student summary
  result.perStudent = perStudent.map((ps) => {
    const initialAvg = ps.firstFb ? overallAvg(ps.firstFb) : null;
    const finalAvg = ps.lastFb ? overallAvg(ps.lastFb) : null;
    return {
      studentId: ps.id,
      studentName: ps.name,
      initialAvg: initialAvg == null ? null : Math.round(initialAvg * 100) / 100,
      finalAvg: finalAvg == null ? null : Math.round(finalAvg * 100) / 100,
      delta: initialAvg != null && finalAvg != null
        ? Math.round((finalAvg - initialAvg) * 100) / 100
        : null,
      sessions: ps.sessions,
      feedbackCount: ps.feedbackCount,
    };
  });

  return result;
}
