"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import type { AttendanceStatus, Feedback } from "@/lib/types";
import { ATTENDANCE_LABELS_EN } from "@/lib/types";
import { markAttendance, clearAttendance } from "@/lib/actions/attendance";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import FeedbackModal from "@/components/FeedbackModal";

export interface BookingEvent {
  id: string;
  slot_id: string;
  student_id: string;
  student_name: string;
  student_username: string;
  student_company: string | null;
  student_phone: string | null;
  course_name: string | null;
  start_at: string;
  end_at: string;
  format: "online" | "offline";
  class_type: "1on1" | "small_group";
  attendance_status: AttendanceStatus | null;
  attendance_notes: string | null;
  feedback: Feedback | null;
}

/**
 * Read-only calendar showing students that have booked this teacher's classes.
 * Day / Week / Month tabs. Click → student detail modal.
 */
export default function ClassSchedulesView({ events }: { events: BookingEvent[] }) {
  const [selected, setSelected] = useState<BookingEvent | null>(null);

  const fcEvents: EventInput[] = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.student_name,
        start: e.start_at,
        end: e.end_at,
        backgroundColor: "#1d4ed8",
        borderColor: "#1d4ed8",
        textColor: "#ffffff",
        extendedProps: e,
      })),
    [events]
  );

  function onEventClick(arg: EventClickArg) {
    setSelected(arg.event.extendedProps as BookingEvent);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Students booked into your classes ({events.length} bookings)
        </h2>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <style>{`
          .fc-event { cursor: pointer; }
          .fc .fc-toolbar-title { font-size: 1rem; font-weight: 600; }
        `}</style>
        <FullCalendar
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "timeGridDay,timeGridWeek,dayGridMonth",
          }}
          buttonText={{ today: "Today", day: "Day", week: "Week", month: "Month" }}
          locale="en"
          slotMinTime="06:00:00"
          slotMaxTime="23:00:00"
          allDaySlot={false}
          nowIndicator
          height="auto"
          events={fcEvents}
          eventClick={onEventClick}
          eventDisplay="block"
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          dayHeaderFormat={{ month: "2-digit", day: "2-digit", weekday: "short" }}
          eventContent={(arg) => {
            const e = arg.event.extendedProps as BookingEvent;
            return (
              <div style={{ padding: "2px 4px", lineHeight: 1.2 }}>
                <div style={{ fontSize: "0.7rem", opacity: 0.9 }}>{arg.timeText}</div>
                <div style={{ fontSize: "0.8rem", fontWeight: 700 }}>{e.student_name}</div>
                <div style={{ fontSize: "0.65rem", opacity: 0.85 }}>
                  {e.class_type === "1on1" ? "1:1" : "Group"} · {e.format === "online" ? "Online" : "Offline"}
                </div>
              </div>
            );
          }}
        />
      </div>

      {events.length === 0 && (
        <p className="mt-4 text-center text-sm text-slate-400">
          No student bookings yet. Add availability so students can book classes with you.
        </p>
      )}

      {selected && (
        <StudentDetailModal event={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function StudentDetailModal({
  event, onClose,
}: {
  event: BookingEvent;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<AttendanceStatus | "">(event.attendance_status ?? "");
  const [notes, setNotes] = useState(event.attendance_notes ?? "");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  const isPast = end.getTime() <= Date.now();

  // Feedback summary (if any leaf ratings are filled)
  const fb = event.feedback;
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

  const classInfo =
    start.toLocaleDateString("en-US", { weekday: "short", month: "2-digit", day: "2-digit" })
    + " · "
    + start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
    + " - "
    + end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  function save() {
    setMsg(null);
    startTransition(async () => {
      if (status === "") {
        // Clear attendance
        const r = await clearAttendance(event.id);
        if (!r.ok) { setMsg({ type: "err", text: r.error ?? "Failed to save" }); return; }
      } else {
        const r = await markAttendance(event.id, status, notes.trim() || undefined);
        if (!r.ok) { setMsg({ type: "err", text: r.error ?? "Failed to save" }); return; }
      }
      setMsg({ type: "ok", text: "Saved." });
      router.refresh();
      setTimeout(onClose, 600);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-1 text-lg font-bold text-slate-800">{event.student_name}</h3>
        <p className="mb-4 text-sm text-slate-500">
          {start.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", hour12: false })}
          {" – "}
          {end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
        </p>

        <dl className="mb-4 space-y-2 text-sm">
          <Row k="Username" v={event.student_username} />
          <Row k="Company" v={event.student_company ?? "—"} />
          <Row k="Course" v={event.course_name ?? "—"} />
          <Row k="Phone" v={event.student_phone ?? "—"} />
          <Row k="Class type" v={event.class_type === "1on1" ? "1:1" : "Small group"} />
          <Row k="Format" v={event.format === "online" ? "Online" : "Offline"} />
        </dl>

        {/* Attendance check */}
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h4 className="mb-2 text-sm font-semibold text-slate-700">✅ Attendance</h4>

          <label className="label">Status</label>
          <select
            className="input"
            value={status}
            disabled={!isPast || pending}
            onChange={(e) => setStatus(e.target.value as AttendanceStatus | "")}
          >
            <option value="">Not marked</option>
            <option value="present">{ATTENDANCE_LABELS_EN.present}</option>
            <option value="late">{ATTENDANCE_LABELS_EN.late}</option>
            <option value="absent">{ATTENDANCE_LABELS_EN.absent}</option>
            <option value="reschedule">{ATTENDANCE_LABELS_EN.reschedule}</option>
            <option value="other">{ATTENDANCE_LABELS_EN.other}</option>
          </select>

          <label className="label mt-3">Memo (optional)</label>
          <textarea
            className="input min-h-[80px]"
            placeholder="Notes about this class — e.g., topics covered, student progress, follow-up items."
            value={notes}
            disabled={!isPast || pending}
            onChange={(e) => setNotes(e.target.value)}
          />

          {!isPast && (
            <p className="mt-2 text-xs text-amber-600">
              This class hasn't started yet — attendance can be marked after the session.
            </p>
          )}
        </div>

        {/* Feedback shortcut — only for past classes */}
        {isPast && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-700">📝 Feedback</h4>
                <p className="text-xs text-slate-500">
                  {fbAvg != null
                    ? `Average: ${fbAvg.toFixed(2)}/10 · ${fbValues.length}/10 items rated`
                    : "Not evaluated yet."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackOpen(true)}
                className="btn !bg-amber-600 hover:!bg-amber-700"
              >
                {fbAvg != null ? "Edit feedback" : "Open feedback"}
              </button>
            </div>
          </div>
        )}

        {msg && (
          <div className={
            "mt-3 rounded-md border p-2 text-sm " +
            (msg.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700")
          }>{msg.text}</div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Close</button>
          {isPast && (
            <button className="btn" disabled={pending} onClick={save}>
              {pending ? "Saving..." : "Save attendance"}
            </button>
          )}
        </div>
      </div>

      {/* Nested feedback modal */}
      {feedbackOpen && (
        <FeedbackModal
          bookingId={event.id}
          studentName={event.student_name}
          classInfo={classInfo}
          existing={event.feedback}
          onClose={() => setFeedbackOpen(false)}
        />
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex border-b border-slate-100 py-1 last:border-b-0">
      <span className="w-28 text-slate-500">{k}</span>
      <span className="flex-1 text-slate-800">{v}</span>
    </div>
  );
}
