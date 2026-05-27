"use client";

import type { ReactNode } from "react";
import { useMemo, useState, useRef } from "react";
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
  zoom_url: string | null;
  teams_url: string | null;
}

/**
 * Read-only calendar showing students that have booked this teacher's classes.
 * Day / Week / Month tabs. Click → student detail modal.
 */
export default function ClassSchedulesView({ events }: { events: BookingEvent[] }) {
  const [selected, setSelected] = useState<BookingEvent | null>(null);
  const [view, setView] = useState<"day" | "week" | "month">("day");
  // 초기 Day 날짜: 오늘 수업이 있으면 오늘, 없으면 다음 예정 수업 날짜로 자동 점프
  const [dayDate, setDayDate] = useState<Date>(() => pickInitialDayDate(events));
  const calRef = useRef<FullCalendar | null>(null);

  // Day 뷰 — 선택한 날짜의 수업만 시간순으로 정렬
  const dayEvents = useMemo(() => {
    const start = new Date(dayDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return events
      .filter((e) => {
        const t = new Date(e.start_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      })
      .sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      );
  }, [events, dayDate]);

  function navigate(action: "prev" | "today" | "next") {
    if (view === "day") {
      if (action === "today") {
        setDayDate(new Date());
        return;
      }
      const d = new Date(dayDate);
      d.setDate(d.getDate() + (action === "next" ? 1 : -1));
      setDayDate(d);
    } else {
      const api = calRef.current?.getApi();
      if (!api) return;
      if (action === "prev") api.prev();
      else if (action === "next") api.next();
      else api.today();
    }
  }

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

      {/* Toolbar — prev/today/next + Day/Week/Month 탭 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-sm">
          <button type="button" onClick={() => navigate("prev")} aria-label="Previous"
            className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-50">◀</button>
          <button type="button" onClick={() => navigate("today")}
            className="rounded px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50">Today</button>
          <button type="button" onClick={() => navigate("next")} aria-label="Next"
            className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-50">▶</button>
          {view === "day" && (
            <span className="ml-2 hidden text-sm font-semibold text-slate-700 sm:inline">
              {dayDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
          )}
        </div>
        <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          {(["day", "week", "month"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={"px-3 py-1.5 text-sm font-medium transition " +
                (view === v ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50")}>
              {v === "day" ? "Day" : v === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
      </div>

      {view === "day" ? (
        <>
          {/* 카드 위 헤딩 — Today's Class / Upcoming Class / Past Class */}
          <div className="mb-3 flex items-baseline gap-3">
            <h3 className="text-lg font-bold text-slate-800">
              {dayLabelEn(dayDate, dayEvents.length > 0)}
            </h3>
            <span className="text-xs text-slate-500">
              {dayDate.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>
          <DayCardList events={dayEvents} onSelect={setSelected} />
        </>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
          <style>{`
            .fc-event { cursor: pointer; }
            .fc .fc-toolbar-title { font-size: 1rem; font-weight: 600; }
            /* 슬롯 높이 확대 — 4줄(시간/이름/회사/타입) 모두 보이도록 */
            .fc .fc-timegrid-slot { height: 3em !important; }
            .fc .fc-timegrid-slot-minor { border-top-style: dotted; }
            .fc-timegrid-event { min-height: 3.5em; }
            .fc-timegrid-event .fc-event-main { padding: 0 !important; }
            .fc-timegrid-event-harness > .fc-timegrid-event { inset: 0 0 0 0 !important; }
            .fc { min-width: 640px; }
            @media (min-width: 768px) { .fc { min-width: 0; } }
          `}</style>
          <FullCalendar
            ref={calRef}
            key={view}
            plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
            initialView={view === "week" ? "timeGridWeek" : "dayGridMonth"}
            headerToolbar={{ left: "", center: "title", right: "" }}
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
            slotDuration="00:30:00"
            eventContent={(arg) => {
              const e = arg.event.extendedProps as BookingEvent;
              return (
                <div style={{ padding: "4px 6px", lineHeight: 1.3, height: "100%", display: "flex", flexDirection: "column", gap: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: "0.72rem", opacity: 0.95, fontWeight: 500 }}>{arg.timeText}</div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {e.student_name}
                  </div>
                  {e.student_company && (
                    <div style={{ fontSize: "0.68rem", opacity: 0.9, fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {e.student_company}
                    </div>
                  )}
                  <div style={{ fontSize: "0.68rem", opacity: 0.9 }}>
                    {e.class_type === "1on1" ? "1:1" : "Group"} · {e.format === "online" ? "Online" : "Offline"}
                  </div>
                </div>
              );
            }}
          />
        </div>
      )}

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

        {/* 온라인 회의실 바로가기 — Zoom / Teams */}
        {event.format === "online" && (event.zoom_url || event.teams_url) && (
          <div className="mb-4 flex flex-wrap gap-2 rounded-md border border-blue-200 bg-blue-50/40 p-3">
            <span className="self-center text-xs font-semibold text-slate-600">🎥 Join class:</span>
            {event.zoom_url && (
              <a
                href={event.zoom_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Open in Zoom ↗
              </a>
            )}
            {event.teams_url && (
              <a
                href={event.teams_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-purple-700"
              >
                Open in Teams ↗
              </a>
            )}
          </div>
        )}
        {event.format === "online" && !event.zoom_url && !event.teams_url && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50/40 p-3 text-xs text-amber-700">
            💡 Set your Zoom / Teams URL in <a href="/teacher/profile" className="font-semibold underline">My Page</a> to enable one-click join.
          </div>
        )}

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
          studentName={event.student_name}
          studentSessions={[{
            booking_id: event.id,
            start_at: event.start_at,
            end_at: event.end_at,
            attendance_marked: event.attendance_status !== null,
            feedback: event.feedback,
          }]}
          initialBookingId={event.id}
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

/* ──────────────────────────────────────────────────────────────────────
   Day 초기 날짜 선택 — 오늘 수업이 있으면 오늘, 없으면 다음 예정 수업 날짜
   ────────────────────────────────────────────────────────────────────── */
function pickInitialDayDate(events: BookingEvent[]): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const hasToday = events.some((e) => {
    const t = new Date(e.start_at).getTime();
    return t >= today.getTime() && t < tomorrow.getTime();
  });
  if (hasToday) return today;

  const nowMs = Date.now();
  const upcoming = events
    .map((e) => new Date(e.start_at).getTime())
    .filter((t) => t >= nowMs)
    .sort((a, b) => a - b);
  if (upcoming.length === 0) return today;
  const next = new Date(upcoming[0]);
  next.setHours(0, 0, 0, 0);
  return next;
}

/* ──────────────────────────────────────────────────────────────────────
   Day 헤딩 (영문) — Today's Class / Upcoming Class / Past Class
   ────────────────────────────────────────────────────────────────────── */
function dayLabelEn(dayDate: Date, hasClasses: boolean): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dayDate);
  d.setHours(0, 0, 0, 0);
  const diff = d.getTime() - today.getTime();
  if (diff === 0) return hasClasses ? "Today's Class" : "No Class Today";
  if (diff > 0) return hasClasses ? "Upcoming Class" : "No Class on This Day";
  return hasClasses ? "Past Class" : "No Class on This Day";
}

/* ──────────────────────────────────────────────────────────────────────
   Day view — 시간순 카드 리스트
   ────────────────────────────────────────────────────────────────────── */
function DayCardList({
  events,
  onSelect,
}: {
  events: BookingEvent[];
  onSelect: (e: BookingEvent) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
        📭 No classes on this day.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {events.map((e) => (
        <ClassCard key={e.id} event={e} onClick={() => onSelect(e)} />
      ))}
    </div>
  );
}

function ClassCard({
  event,
  onClick,
}: {
  event: BookingEvent;
  onClick: () => void;
}) {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  const now = Date.now();
  const isPast = end.getTime() <= now;
  const isOngoing = start.getTime() <= now && end.getTime() > now;

  // Feedback summary (avg of completed ratings, if any)
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

  const timeFmt = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "block w-full rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md " +
        (isOngoing
          ? "border-blue-400 ring-2 ring-blue-100"
          : isPast
          ? "border-slate-200 opacity-75"
          : "border-slate-200")
      }
    >
      <div className="flex items-start gap-3">
        {/* 시간 컬럼 */}
        <div className="w-20 flex-shrink-0 text-center sm:w-24">
          <div className="text-base font-bold text-brand-700 sm:text-lg">
            {timeFmt(start)}
          </div>
          <div className="text-xs text-slate-400">{timeFmt(end)}</div>
        </div>

        {/* 본문 */}
        <div className="min-w-0 flex-1 border-l border-slate-100 pl-3">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="truncate text-base font-bold text-slate-800">
              {event.student_name}
            </span>
            {isOngoing && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                ● LIVE
              </span>
            )}
            {isPast && !isOngoing && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                Done
              </span>
            )}
          </div>
          {event.student_company && (
            <div className="truncate text-xs italic text-slate-500">
              🏢 {event.student_company}
            </div>
          )}
          {event.course_name && (
            <div className="truncate text-xs text-slate-500">
              📚 {event.course_name}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Pill>{event.class_type === "1on1" ? "1:1" : "Group"}</Pill>
            <Pill>{event.format === "online" ? "💻 Online" : "🏫 Offline"}</Pill>
            {event.attendance_status && (
              <Pill color="emerald">
                ✓ {ATTENDANCE_LABELS_EN[event.attendance_status]}
              </Pill>
            )}
            {fbAvg != null && (
              <Pill color="amber">⭐ {fbAvg.toFixed(1)}/10</Pill>
            )}
          </div>
        </div>

        <div className="self-center text-lg text-slate-300">›</div>
      </div>
    </button>
  );
}

function Pill({
  children,
  color = "slate",
}: {
  children: ReactNode;
  color?: "slate" | "emerald" | "amber" | "blue";
}) {
  const styles: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={"rounded-full px-2 py-0.5 text-[11px] font-medium " + styles[color]}>
      {children}
    </span>
  );
}
