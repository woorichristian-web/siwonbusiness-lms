"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAttendance, clearAttendance } from "@/lib/actions/attendance";
import type { AttendanceStatus, ClassFormat, ClassType, Feedback } from "@/lib/types";
import { ATTENDANCE_LABELS_EN } from "@/lib/types";
import FeedbackModal, { type SessionEntry } from "@/components/FeedbackModal";

export interface ClassRow {
  booking_id: string;
  slot_id: string;
  start_at: string;
  end_at: string;
  student_id: string;
  student_name: string;
  student_username: string;
  student_company: string | null;
  course_name: string | null;
  class_type: ClassType;
  format: ClassFormat;
  attendance: AttendanceStatus | null;
  feedback: Feedback | null;
}

interface StudentRate {
  total: number;
  attended: number;
  present: number;
  late: number;
  absent: number;
  reschedule: number;
  other: number;
  rate: number | null;
}

/**
 * Teacher's Management page.
 * - Top: "Unevaluated" — past sessions missing attendance or submitted feedback
 * - Below: All sessions grouped by course
 */
export default function ClassManageView({ rows }: { rows: ClassRow[] }) {
  // Cumulative attendance stats per student (across all rows)
  const studentRates = useMemo(() => {
    const map = new Map<string, StudentRate>();
    for (const r of rows) {
      const cur = map.get(r.student_id) ?? {
        total: 0, attended: 0, present: 0, late: 0, absent: 0, reschedule: 0, other: 0, rate: null,
      };
      if (r.attendance === "present") { cur.present++; cur.attended++; cur.total++; }
      else if (r.attendance === "late") { cur.late++; cur.attended++; cur.total++; }
      else if (r.attendance === "absent") { cur.absent++; cur.total++; }
      else if (r.attendance === "reschedule") { cur.reschedule++; }
      else if (r.attendance === "other") { cur.other++; }
      map.set(r.student_id, cur);
    }
    for (const [, v] of map) {
      v.rate = v.total === 0 ? null : Math.round((v.attended / v.total) * 100);
    }
    return map;
  }, [rows]);

  // 학생별 모든 수업 (FeedbackModal에 전달용)
  const sessionsByStudent = useMemo(() => {
    const map = new Map<string, SessionEntry[]>();
    for (const r of rows) {
      const entry: SessionEntry = {
        booking_id: r.booking_id,
        start_at: r.start_at,
        end_at: r.end_at,
        attendance_marked: r.attendance != null,
        feedback: r.feedback,
      };
      if (!map.has(r.student_id)) map.set(r.student_id, []);
      map.get(r.student_id)!.push(entry);
    }
    return map;
  }, [rows]);

  // Unevaluated: 지난 수업 중 출석 미체크 OR 피드백 미제출
  const now = Date.now();
  const unevaluated = useMemo(
    () =>
      rows.filter((r) => {
        const isPast = new Date(r.end_at).getTime() <= now;
        if (!isPast) return false;
        const attMissing = r.attendance == null;
        const fbMissing = !r.feedback || r.feedback.status !== "submitted";
        return attMissing || fbMissing;
      }).sort((a, b) =>
        new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
      ),
    [rows, now]
  );

  // 강좌별 그룹
  const courses = useMemo(() => {
    const map = new Map<string, ClassRow[]>();
    for (const r of rows) {
      const key = r.course_name ?? "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* === Unevaluated 섹션 === */}
      <section
        className={
          "rounded-lg border bg-white " +
          (unevaluated.length > 0 ? "border-red-300" : "border-emerald-200")
        }
      >
        <header className={
          "border-b px-4 py-3 " +
          (unevaluated.length > 0 ? "border-red-100 bg-red-50/40" : "border-emerald-100 bg-emerald-50/40")
        }>
          <h2 className="font-semibold text-slate-800">
            {unevaluated.length > 0 ? "🔴 Unevaluated" : "✓ All caught up"}
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({unevaluated.length} pending)
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            출석 미체크 또는 피드백 미제출 항목입니다. 우선 처리해주세요.
          </p>
        </header>

        {unevaluated.length === 0 ? (
          <p className="p-4 text-center text-sm text-slate-500">
            모든 과거 수업의 출석/평가가 완료되었습니다 🎉
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">날짜</th>
                  <th className="px-4 py-2">학생</th>
                  <th className="px-4 py-2">출석</th>
                  <th className="px-4 py-2">평가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unevaluated.map((r) => (
                  <UnevaluatedRow
                    key={r.booking_id}
                    row={r}
                    sessions={sessionsByStudent.get(r.student_id) ?? []}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* === 강좌별 전체 목록 === */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            전체 강좌 ({courses.length})
          </h2>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            No bookings yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {courses.map(([courseName, items]) => (
              <CourseCard
                key={courseName}
                courseName={courseName}
                items={items}
                studentRates={studentRates}
                sessionsByStudent={sessionsByStudent}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ===================================================================
// Unevaluated row
// ===================================================================
function UnevaluatedRow({
  row, sessions,
}: {
  row: ClassRow;
  sessions: SessionEntry[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fbOpen, setFbOpen] = useState(false);
  const d = new Date(row.start_at);

  function onAttChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    startTransition(async () => {
      if (v === "") await clearAttendance(row.booking_id);
      else await markAttendance(row.booking_id, v as AttendanceStatus);
      router.refresh();
    });
  }

  const attMissing = row.attendance == null;
  const fbMissing = !row.feedback || row.feedback.status !== "submitted";
  const fbIsDraft = row.feedback?.status === "draft";

  return (
    <>
      <tr>
        <td className="px-4 py-2.5 text-slate-700">
          {d.toLocaleDateString("en-US", { weekday: "short", month: "2-digit", day: "2-digit" })}
          {" · "}
          {d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
        </td>
        <td className="px-4 py-2.5 font-medium text-slate-800">
          {row.student_name}
          {row.student_company && (
            <span className="ml-1 text-xs text-slate-400">({row.student_company})</span>
          )}
        </td>
        <td className="px-4 py-2.5">
          {attMissing ? (
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-500" />
          ) : (
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
          )}
          <select
            disabled={pending}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
            value={row.attendance ?? ""}
            onChange={onAttChange}
          >
            <option value="">Not marked</option>
            <option value="present">{ATTENDANCE_LABELS_EN.present}</option>
            <option value="late">{ATTENDANCE_LABELS_EN.late}</option>
            <option value="absent">{ATTENDANCE_LABELS_EN.absent}</option>
            <option value="reschedule">{ATTENDANCE_LABELS_EN.reschedule}</option>
            <option value="other">{ATTENDANCE_LABELS_EN.other}</option>
          </select>
        </td>
        <td className="px-4 py-2.5">
          <button
            type="button"
            onClick={() => setFbOpen(true)}
            className={
              "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition " +
              (fbMissing
                ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100")
            }
          >
            <span className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: fbMissing ? "#ef4444" : "#10b981" }} />
            {fbIsDraft ? "임시저장됨 · 평가 이어하기"
              : fbMissing ? "📝 평가 작성"
              : "📝 평가 완료 · 보기"}
          </button>
        </td>
      </tr>
      {fbOpen && (
        <tr>
          <td colSpan={4}>
            <FeedbackModal
              studentName={row.student_name}
              studentSessions={sessions}
              initialBookingId={row.booking_id}
              onClose={() => setFbOpen(false)}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ===================================================================
// Course card (expandable, contains sessions)
// ===================================================================
function CourseCard({
  courseName, items, studentRates, sessionsByStudent,
}: {
  courseName: string;
  items: ClassRow[];
  studentRates: Map<string, StudentRate>;
  sessionsByStudent: Map<string, SessionEntry[]>;
}) {
  const uniqueStudents = useMemo(() => {
    const set = new Set<string>();
    for (const r of items) set.add(r.student_id);
    return set;
  }, [items]);

  const sessions = useMemo(() => {
    const map = new Map<string, ClassRow[]>();
    for (const r of items) {
      const key = `${r.slot_id}|${r.start_at}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    const entries = Array.from(map.entries());
    entries.sort(([, a], [, b]) =>
      new Date(b[0].start_at).getTime() - new Date(a[0].start_at).getTime()
    );
    return entries;
  }, [items]);

  const pattern = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const set = new Set<string>();
    for (const r of items) {
      const d = new Date(r.start_at);
      const e = new Date(r.end_at);
      const day = days[d.getDay()];
      const hm = (x: Date) => `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
      set.add(`${day} ${hm(d)}-${hm(e)}`);
    }
    return Array.from(set).sort();
  }, [items]);

  const first = items[0];
  const [open, setOpen] = useState(true);

  return (
    <li className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between border-b border-slate-100 bg-gradient-to-r from-brand-50 to-white px-5 py-4 text-left transition hover:from-brand-100"
      >
        <div>
          <div className="flex items-center gap-2 text-lg font-bold text-brand-900">
            📚 <span>{courseName}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="rounded-full bg-slate-100 px-2 py-0.5">
              {first.class_type === "1on1" ? "1:1" : "Group"}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5">
              {first.format === "online" ? "Online" : "Offline"}
            </span>
            <span>·</span>
            <span><b>{uniqueStudents.size}</b> student{uniqueStudents.size === 1 ? "" : "s"}</span>
            <span>·</span>
            <span><b>{sessions.length}</b> session{sessions.length === 1 ? "" : "s"}</span>
            {pattern.length > 0 && (
              <>
                <span>·</span>
                <span className="text-slate-500">{pattern.join(", ")}</span>
              </>
            )}
          </div>
        </div>
        <span className="text-2xl text-slate-400">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="divide-y divide-slate-100">
          {sessions.map(([key, sessionRows]) => (
            <SessionBlock
              key={key}
              rows={sessionRows}
              studentRates={studentRates}
              sessionsByStudent={sessionsByStudent}
            />
          ))}
        </div>
      )}
    </li>
  );
}

function SessionBlock({
  rows, studentRates, sessionsByStudent,
}: {
  rows: ClassRow[];
  studentRates: Map<string, StudentRate>;
  sessionsByStudent: Map<string, SessionEntry[]>;
}) {
  const first = rows[0];
  const start = new Date(first.start_at);
  const end = new Date(first.end_at);
  const isPast = end.getTime() <= Date.now();
  const markedCount = rows.filter((r) => r.attendance).length;

  return (
    <div className="px-5 py-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <div>
          <span className="font-semibold text-slate-800">
            {start.toLocaleDateString("en-US", { weekday: "short", month: "2-digit", day: "2-digit" })}
            {" · "}
            {start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
            {" - "}
            {end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
          </span>
          {isPast ? (
            <span className={"ml-2 text-xs " + (markedCount === rows.length ? "text-emerald-600" : "text-amber-600")}>
              · Attendance {markedCount}/{rows.length}
            </span>
          ) : (
            <span className="ml-2 text-xs text-blue-600">· Upcoming</span>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {rows.length} student{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="pb-1 font-medium">Student</th>
            <th className="pb-1 font-medium">Company</th>
            <th className="pb-1 font-medium">Attendance</th>
            <th className="pb-1 font-medium">Feedback</th>
            <th className="pb-1 font-medium">Progress</th>
            <th className="pb-1 font-medium">Overall rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((r) => (
            <StudentRow
              key={r.booking_id}
              row={r}
              rate={studentRates.get(r.student_id)}
              isPast={isPast}
              sessions={sessionsByStudent.get(r.student_id) ?? []}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StudentRow({
  row, rate, isPast, sessions,
}: {
  row: ClassRow;
  rate: StudentRate | undefined;
  isPast: boolean;
  sessions: SessionEntry[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    startTransition(async () => {
      if (v === "") await clearAttendance(row.booking_id);
      else await markAttendance(row.booking_id, v as AttendanceStatus);
      router.refresh();
    });
  }

  const fb = row.feedback;
  const fbValues = fb
    ? [
        fb.grammar_accuracy, fb.grammar_complexity,
        fb.vocabulary_diversity, fb.vocabulary_relevancy,
        fb.comprehension,
        fb.content_clarity, fb.content_organization,
        fb.participation, fb.tone_manner, fb.preparation,
      ].filter((v): v is number => typeof v === "number")
    : [];
  const fbAvg = fbValues.length === 0
    ? null
    : fbValues.reduce((s, n) => s + n, 0) / fbValues.length;
  const fbStatus = fb?.status ?? null;

  return (
    <>
      <tr>
        <td className="py-1.5 font-medium text-slate-800">{row.student_name}</td>
        <td className="py-1.5 text-slate-600">{row.student_company ?? "—"}</td>
        <td className="py-1.5">
          {isPast ? (
            <select
              disabled={pending}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
              value={row.attendance ?? ""}
              onChange={onChange}
            >
              <option value="">Not marked</option>
              <option value="present">{ATTENDANCE_LABELS_EN.present}</option>
              <option value="late">{ATTENDANCE_LABELS_EN.late}</option>
              <option value="absent">{ATTENDANCE_LABELS_EN.absent}</option>
              <option value="reschedule">{ATTENDANCE_LABELS_EN.reschedule}</option>
              <option value="other">{ATTENDANCE_LABELS_EN.other}</option>
            </select>
          ) : (
            <span className="text-xs text-slate-400">— (upcoming)</span>
          )}
        </td>
        <td className="py-1.5">
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            disabled={!isPast}
            className={
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition " +
              (!isPast
                ? "cursor-not-allowed border-slate-200 text-slate-400"
                : fbStatus === "submitted"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : fbStatus === "draft"
                    ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100")
            }
          >
            {fbStatus === "submitted" && <>✓ {fbAvg!.toFixed(1)} ({fbValues.length}/10)</>}
            {fbStatus === "draft" && <>📝 Draft ({fbValues.length}/10)</>}
            {!fbStatus && isPast && <>🔴 Feedback</>}
            {!isPast && <>Feedback</>}
          </button>
        </td>
        <td className="py-1.5">
          <Link
            href={`/teacher/progress/${row.student_id}`}
            className="inline-flex items-center gap-1 rounded-md border border-brand-300 bg-brand-50 px-2 py-1 text-xs text-brand-700 hover:bg-brand-100"
          >
            📈 Progress
          </Link>
        </td>
        <td className="py-1.5">
          {rate && rate.total > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <span className={
                "rounded-full px-2 py-0.5 text-xs font-bold " +
                ((rate.rate ?? 0) >= 80
                  ? "bg-emerald-100 text-emerald-700"
                  : (rate.rate ?? 0) >= 60
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700")
              }>
                {rate.rate}%
              </span>
              <span className="text-xs text-slate-500">
                ({rate.attended}/{rate.total})
              </span>
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>
      </tr>

      {feedbackOpen && (
        <tr>
          <td colSpan={6}>
            <FeedbackModal
              studentName={row.student_name}
              studentSessions={sessions}
              initialBookingId={row.booking_id}
              onClose={() => setFeedbackOpen(false)}
            />
          </td>
        </tr>
      )}
    </>
  );
}
