"use client";

import { useMemo, useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import type { TimeSlot, ClassFormat, ClassType } from "@/lib/types";
import { createSlot, updateSlot, deleteSlot } from "@/lib/actions/slots";

export default function TeacherScheduleEditor({
  slots,
  bookingCounts,
}: {
  slots: TimeSlot[];
  bookingCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<TimeSlot | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [dayDate, setDayDate] = useState<Date>(() => new Date());
  const calRef = useRef<FullCalendar | null>(null);

  // Day 뷰 — 선택한 날짜의 슬롯을 시간순으로 정렬
  const daySlots = useMemo(() => {
    const start = new Date(dayDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return slots
      .filter((s) => {
        const t = new Date(s.start_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      })
      .sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      );
  }, [slots, dayDate]);

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

  // Calendar events
  const events: EventInput[] = useMemo(
    () => {
      const now = Date.now();
      return slots.map((s) => {
        const booked = bookingCounts[s.id] ?? 0;
        const full = booked >= s.capacity;
        const closed = s.status === "closed";
        const past = new Date(s.end_at).getTime() <= now;
        const bg = past
          ? "#94a3b8"
          : closed
          ? "#94a3b8"
          : full
          ? "#1e40af"
          : booked > 0
          ? "#2563eb"
          : "#10b981";
        return {
          id: s.id,
          start: s.start_at,
          end: s.end_at,
          backgroundColor: bg,
          borderColor: bg,
          textColor: "#ffffff",
          classNames: past ? ["fc-past"] : [],
          extendedProps: { slot: s, booked, past },
        };
      });
    },
    [slots, bookingCounts]
  );

  function onEventClick(arg: EventClickArg) {
    const slot = (arg.event.extendedProps as any).slot as TimeSlot;
    setEditing(slot);
    setError(null);
  }

  function refresh() { router.refresh(); }

  function onDelete(id: string) {
    if (!confirm("Delete this time slot? Any student bookings linked to it will be removed too.")) return;
    startTransition(async () => {
      const r = await deleteSlot(id);
      if (!r.ok) setError(r.error ?? "Failed to delete");
      else refresh();
    });
  }

  function toggleStatus(s: TimeSlot) {
    startTransition(async () => {
      const next = s.status === "open" ? "closed" : "open";
      const r = await updateSlot(s.id, { status: next });
      if (!r.ok) setError(r.error ?? "Failed to update");
      else refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">My Schedule ({slots.length} slots)</h2>
        <button className="btn" onClick={() => setEditing("new")}>+ Add time</button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

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
        <div className="mb-6">
          <div className="mb-2 text-sm font-semibold text-slate-700 sm:hidden">
            {dayDate.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "long", day: "numeric" })}
          </div>
          <SlotCardList
            slots={daySlots}
            bookingCounts={bookingCounts}
            onEdit={(s) => { setEditing(s); setError(null); }}
            onToggleStatus={toggleStatus}
            onDelete={onDelete}
            pending={pending}
          />
        </div>
      ) : (
        <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
          <style>{`
            .fc-event { cursor: pointer; }
            .fc .fc-toolbar-title { font-size: 1rem; font-weight: 600; }
            .fc-past { opacity: 0.5; }
            /* 슬롯 높이 확대 — 시간/타입/예약수가 잘리지 않도록 */
            .fc .fc-timegrid-slot { height: 3em !important; }
            .fc .fc-timegrid-slot-minor { border-top-style: dotted; }
            .fc-timegrid-event { min-height: 3em; }
            .fc-timegrid-event .fc-event-main { padding: 0 !important; }
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
            events={events}
            eventClick={onEventClick}
            eventDisplay="block"
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            dayHeaderFormat={{ month: "2-digit", day: "2-digit", weekday: "short" }}
            slotDuration="00:30:00"
            eventContent={(arg) => {
              const { slot, booked } = arg.event.extendedProps as { slot: TimeSlot; booked: number };
              return (
                <div style={{ padding: "4px 6px", lineHeight: 1.3, height: "100%", display: "flex", flexDirection: "column", gap: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: "0.72rem", opacity: 0.95, fontWeight: 500 }}>{arg.timeText}</div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {slot.class_type === "1on1" ? "1:1" : "Group"} · {slot.format === "online" ? "Online" : "Offline"}
                  </div>
                  <div style={{ fontSize: "0.68rem", opacity: 0.9 }}>
                    Booked {booked}/{slot.capacity} · {slot.status === "open" ? "Open" : "Closed"}
                  </div>
                </div>
              );
            }}
          />
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            <Legend color="#10b981" label="Available" />
            <Legend color="#2563eb" label="Partially booked" />
            <Legend color="#1e40af" label="Fully booked" />
            <Legend color="#94a3b8" label="Closed / Past" />
            <span className="text-slate-400">· Click a block to edit</span>
          </div>
        </div>
      )}

      {/* Table view */}
      <h3 className="mb-2 text-sm font-semibold text-slate-700">List view</h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Start</th>
              <th className="px-4 py-2">End</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Format</th>
              <th className="px-4 py-2">Length</th>
              <th className="px-4 py-2">Capacity</th>
              <th className="px-4 py-2">Booked</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {slots.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-400">
                No time slots yet. Click "+ Add time" to create one.
              </td></tr>
            )}
            {slots.map((s) => {
              const totalMin = (new Date(s.end_at).getTime() - new Date(s.start_at).getTime()) / 60000;
              const subSlots = Math.floor(totalMin / s.slot_duration_minutes) * s.capacity;
              const past = new Date(s.end_at).getTime() <= Date.now();
              return (
              <tr key={s.id} className={past ? "opacity-50" : ""}>
                <td className="px-4 py-2">{fmt(s.start_at)}</td>
                <td className="px-4 py-2">{fmt(s.end_at)}</td>
                <td className="px-4 py-2">{s.class_type === "1on1" ? "1:1" : "Group"}</td>
                <td className="px-4 py-2">{s.format === "online" ? "Online" : "Offline"}</td>
                <td className="px-4 py-2">{s.slot_duration_minutes} min</td>
                <td className="px-4 py-2">{s.capacity}</td>
                <td className="px-4 py-2">{bookingCounts[s.id] ?? 0} / {subSlots}</td>
                <td className="px-4 py-2">
                  <button onClick={() => toggleStatus(s)}
                    className={"rounded-full px-2 py-0.5 text-xs " +
                      (s.status === "open" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500")}>
                    {s.status === "open" ? "Open" : "Closed"}
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <button className="text-xs text-brand-600 hover:underline" onClick={() => setEditing(s)}>Edit</button>
                  <button className="ml-3 text-xs text-red-600 hover:underline"
                    onClick={() => onDelete(s.id)} disabled={pending}>Delete</button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <SlotForm
          initial={editing === "new" ? null : editing}
          onClose={() => { setEditing(null); setError(null); }}
          onSaved={() => { setEditing(null); refresh(); }}
          onError={setError}
        />
      )}
    </div>
  );
}

// 시(00~23) 와 분(00,10,20,30,40,50) 옵션
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "10", "20", "30", "40", "50"];

function splitDateTime(iso?: string | null) {
  if (!iso) return { date: "", hour: "09", minute: "00" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: "", hour: "09", minute: "00" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hour: pad(d.getHours()),
    minute: pad(Math.floor(d.getMinutes() / 10) * 10),
  };
}

function combineDateTime(date: string, hour: string, minute: string): string {
  if (!date) return "";
  const [y, m, day] = date.split("-").map(Number);
  const d = new Date(y, m - 1, day, Number(hour), Number(minute), 0, 0);
  return d.toISOString();
}

function SlotForm({
  initial, onClose, onSaved, onError,
}: {
  initial: TimeSlot | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const s0 = splitDateTime(initial?.start_at);
  const e0 = splitDateTime(initial?.end_at);

  const [startDate, setStartDate] = useState(s0.date);
  const [startHour, setStartHour] = useState(s0.hour);
  const [startMin, setStartMin] = useState(s0.minute);

  const [endDate, setEndDate] = useState(e0.date || s0.date);
  const [endHour, setEndHour] = useState(e0.hour);
  const [endMin, setEndMin] = useState(e0.minute);

  const [format, setFormat] = useState<ClassFormat>(initial?.format ?? "online");
  const [type, setType] = useState<ClassType>(initial?.class_type ?? "1on1");
  const [capacity, setCapacity] = useState(initial?.capacity ?? 1);
  const [duration, setDuration] = useState<30 | 60>(initial?.slot_duration_minutes ?? 60);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) return onError("Please select start and end dates.");

    const start_at = combineDateTime(startDate, startHour, startMin);
    const end_at = combineDateTime(endDate, endHour, endMin);

    if (new Date(end_at) <= new Date(start_at)) {
      return onError("End time must be after start time.");
    }
    const totalMin = (new Date(end_at).getTime() - new Date(start_at).getTime()) / 60000;
    if (totalMin % duration !== 0) {
      return onError(`Total length (${totalMin} min) is not a multiple of class length (${duration} min).`);
    }

    const payload = { start_at, end_at, format, class_type: type, capacity, slot_duration_minutes: duration };
    startTransition(async () => {
      const r = initial
        ? await updateSlot(initial.id, payload)
        : await createSlot(payload);
      if (!r.ok) return onError(r.error ?? "Failed to save");
      onSaved();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-bold">{initial ? "Edit time slot" : "Add time slot"}</h3>

        <div className="space-y-3">
          <div>
            <label className="label">Start</label>
            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              <input type="date" className="input" required value={startDate}
                onChange={(e) => setStartDate(e.target.value)} />
              <select className="input w-20" value={startHour}
                onChange={(e) => setStartHour(e.target.value)}>
                {HOURS.map((h) => <option key={h} value={h}>{h}h</option>)}
              </select>
              <select className="input w-20" value={startMin}
                onChange={(e) => setStartMin(e.target.value)}>
                {MINUTES.map((m) => <option key={m} value={m}>{m}m</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">End</label>
            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              <input type="date" className="input" required value={endDate}
                onChange={(e) => setEndDate(e.target.value)} />
              <select className="input w-20" value={endHour}
                onChange={(e) => setEndHour(e.target.value)}>
                {HOURS.map((h) => <option key={h} value={h}>{h}h</option>)}
              </select>
              <select className="input w-20" value={endMin}
                onChange={(e) => setEndMin(e.target.value)}>
                {MINUTES.map((m) => <option key={m} value={m}>{m}m</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Class type</label>
              <select className="input" value={type} onChange={(e) => setType(e.target.value as ClassType)}>
                <option value="1on1">1:1</option>
                <option value="small_group">Small group</option>
              </select>
            </div>
            <div>
              <label className="label">Format</label>
              <select className="input" value={format} onChange={(e) => setFormat(e.target.value as ClassFormat)}>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Class length (student booking unit)</label>
              <select className="input" value={duration}
                onChange={(e) => setDuration(Number(e.target.value) as 30 | 60)}>
                <option value={30}>30 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
            <div>
              <label className="label">Capacity</label>
              <input type="number" min={1} max={50} className="input" value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "2-digit", day: "2-digit", weekday: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Day view — 슬롯 카드 리스트
   ────────────────────────────────────────────────────────────────────── */
function SlotCardList({
  slots,
  bookingCounts,
  onEdit,
  onToggleStatus,
  onDelete,
  pending,
}: {
  slots: TimeSlot[];
  bookingCounts: Record<string, number>;
  onEdit: (s: TimeSlot) => void;
  onToggleStatus: (s: TimeSlot) => void;
  onDelete: (id: string) => void;
  pending: boolean;
}) {
  if (slots.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
        📭 No time slots on this day. Click "+ Add time" to create one.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {slots.map((s) => (
        <SlotCard
          key={s.id}
          slot={s}
          booked={bookingCounts[s.id] ?? 0}
          onEdit={() => onEdit(s)}
          onToggleStatus={() => onToggleStatus(s)}
          onDelete={() => onDelete(s.id)}
          pending={pending}
        />
      ))}
    </div>
  );
}

function SlotCard({
  slot,
  booked,
  onEdit,
  onToggleStatus,
  onDelete,
  pending,
}: {
  slot: TimeSlot;
  booked: number;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const start = new Date(slot.start_at);
  const end = new Date(slot.end_at);
  const now = Date.now();
  const isPast = end.getTime() <= now;
  const isOngoing = start.getTime() <= now && end.getTime() > now;
  const totalMin = (end.getTime() - start.getTime()) / 60000;
  const subSlots = Math.floor(totalMin / slot.slot_duration_minutes) * slot.capacity;
  const isFull = booked >= subSlots;
  const isClosed = slot.status === "closed";

  const timeFmt = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div
      className={
        "rounded-lg border bg-white p-4 shadow-sm transition " +
        (isOngoing
          ? "border-blue-400 ring-2 ring-blue-100"
          : isPast || isClosed
          ? "border-slate-200 opacity-75"
          : isFull
          ? "border-blue-300"
          : "border-emerald-200")
      }
    >
      <div className="flex flex-wrap items-start gap-3">
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
            <span className="text-base font-bold text-slate-800">
              {slot.class_type === "1on1" ? "1:1" : "Small group"} ·{" "}
              {slot.format === "online" ? "Online" : "Offline"}
            </span>
            {isOngoing && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                ● LIVE
              </span>
            )}
            {isPast && !isOngoing && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                Past
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            {slot.slot_duration_minutes} min · {totalMin} min total
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={
                "rounded-full px-2 py-0.5 text-[11px] font-medium " +
                (isFull
                  ? "bg-blue-100 text-blue-700"
                  : booked > 0
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-500")
              }
            >
              Booked {booked}/{subSlots}
            </span>
            <button
              type="button"
              onClick={onToggleStatus}
              disabled={pending}
              className={
                "rounded-full px-2 py-0.5 text-[11px] font-medium transition " +
                (slot.status === "open"
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200")
              }
            >
              {slot.status === "open" ? "Open" : "Closed"}
            </button>
          </div>
        </div>

        {/* 액션 */}
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="text-xs text-red-600 hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
