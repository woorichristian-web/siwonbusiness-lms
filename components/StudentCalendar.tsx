"use client";

import { useMemo, useState, useTransition } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import multiMonthPlugin from "@fullcalendar/multimonth";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import koLocale from "@fullcalendar/core/locales/ko";
import type { BookableSlot } from "@/lib/types";
import { bookSlot, cancelBooking } from "@/lib/actions/booking";

export default function StudentCalendar({ slots }: { slots: BookableSlot[] }) {
  const [selected, setSelected] = useState<BookableSlot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const events: EventInput[] = useMemo(
    () =>
      slots.map((s) => ({
        // 같은 가능시간 안에 같은 시작시각이 두 번 나올 수 없으므로 합성 키 사용
        id: `${s.availability_id}|${s.start_at}`,
        title: s.teacher_name,
        start: s.start_at,
        end: s.end_at,
        extendedProps: s,
        backgroundColor: bg(s),
        borderColor: bg(s),
        textColor: "#ffffff",
        classNames: [
          s.i_am_booked ? "fc-mine" : "",
          s.is_past ? "fc-past" : "",
        ].filter(Boolean),
      })),
    [slots]
  );

  function onEventClick(arg: EventClickArg) {
    const slot = arg.event.extendedProps as BookableSlot;
    setSelected(slot);
    setMessage(null);
  }

  function refresh() {
    window.location.reload();
  }

  function onBook() {
    if (!selected) return;
    startTransition(async () => {
      const res = await bookSlot(selected.availability_id, selected.start_at);
      if (!res.ok) { setMessage(res.error ?? "신청 실패"); return; }
      setMessage("신청되었습니다!");
      setTimeout(refresh, 600);
    });
  }

  function onCancel() {
    if (!selected) return;
    startTransition(async () => {
      const res = await cancelBooking(selected.availability_id, selected.start_at);
      if (!res.ok) { setMessage(res.error ?? "취소 실패"); return; }
      setMessage("취소되었습니다.");
      setTimeout(refresh, 600);
    });
  }

  return (
    <div className="overflow-x-auto">
      <style>{calendarStyles}</style>
      <FullCalendar
        plugins={[timeGridPlugin, dayGridPlugin, multiMonthPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "timeGridWeek,dayGridMonth,multiMonthYear",
        }}
        buttonText={{
          today: "오늘",
          week: "Week",
          month: "Month",
          year: "Year",
        }}
        views={{
          multiMonthYear: {
            type: "multiMonth",
            duration: { years: 1 },
            multiMonthMaxColumns: 3,
          },
        }}
        locale={koLocale}
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
        eventContent={(arg) => {
          const slot = arg.event.extendedProps as BookableSlot;
          return (
            <div className="fc-event-inner">
              <div className="fc-event-time">{arg.timeText}</div>
              <div className="fc-event-name">
                {slot.i_am_booked && <span className="fc-mine-check">✓ </span>}
                {slot.teacher_name}
              </div>
              <div className="fc-event-sub">
                {slot.class_type === "1on1" ? "1:1" : "그룹"} ·{" "}
                {slot.format === "online" ? "온라인" : "오프라인"} ·{" "}
                {slot.booked_count}/{slot.capacity}
              </div>
            </div>
          );
        }}
      />

      {selected && (
        <SlotModal
          slot={selected}
          message={message}
          pending={pending}
          onClose={() => setSelected(null)}
          onBook={onBook}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}

function bg(s: BookableSlot) {
  if (s.is_past) return "#94a3b8";                    // 회색 — 지나간 시간 (마감 처리)
  if (s.status === "closed") return "#94a3b8";        // 회색 — 강사 마감
  if (s.i_am_booked) return "#059669";                // 초록(emerald-600) — 내가 신청한 수업
  if (s.booked_count >= s.capacity) return "#cbd5e1"; // 옅은 회색 — 정원 가득
  return "#3b82f6";                                   // 파랑 — 신청 가능
}

function SlotModal({
  slot, message, pending, onClose, onBook, onCancel,
}: {
  slot: BookableSlot;
  message: string | null;
  pending: boolean;
  onClose: () => void;
  onBook: () => void;
  onCancel: () => void;
}) {
  const start = new Date(slot.start_at);
  const end = new Date(slot.end_at);
  const isFull = slot.booked_count >= slot.capacity && !slot.i_am_booked;
  const isClosed = slot.status === "closed";
  const isPast = slot.is_past;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
         onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-800">{slot.teacher_name} 강사</h3>
          <p className="text-sm text-slate-500">
            {format(start)} ~ {formatTime(end)}
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <Row k="수업 형태" v={slot.class_type === "1on1" ? "1:1 개인" : "소그룹"} />
          <Row k="진행 방식" v={slot.format === "online" ? "온라인" : "오프라인"} />
          <Row k="정원" v={`${slot.booked_count} / ${slot.capacity} 명`} />
          <Row k="상태" v={
            isPast ? (slot.i_am_booked ? "이미 끝난 수업 (내가 신청했던 수업)" : "이미 지난 시간") :
            isClosed ? "마감됨" :
            slot.i_am_booked ? "내가 신청한 수업" :
            isFull ? "정원 마감" : "신청 가능"
          } />
        </div>

        {message && (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
            {message}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>닫기</button>
          {isPast ? (
            // 지나간 슬롯 — 신청/취소 모두 불가, 닫기만
            null
          ) : slot.i_am_booked ? (
            <button className="btn !bg-red-600 hover:!bg-red-700" disabled={pending}
              onClick={onCancel}>
              {pending ? "취소 중..." : "수업 취소"}
            </button>
          ) : (
            <button className="btn" disabled={pending || isFull || isClosed}
              onClick={onBook}>
              {pending ? "신청 중..." : "수업 신청"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex border-b border-slate-100 py-1">
      <span className="w-24 text-slate-500">{k}</span>
      <span className="flex-1 text-slate-800">{v}</span>
    </div>
  );
}

function format(d: Date) {
  return d.toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}
function formatTime(d: Date) {
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

const calendarStyles = `
.fc-event-inner { padding: 2px 4px; line-height: 1.2; }
.fc-event-time  { font-size: 0.7rem; opacity: 0.9; }
.fc-event-name  { font-size: 0.8rem; font-weight: 500; }
.fc-event-sub   { font-size: 0.65rem; opacity: 0.85; margin-top: 1px; }
.fc-mine .fc-event-name { font-weight: 700; }
.fc-mine-check { font-weight: 700; }
.fc-event { cursor: pointer; }
.fc-past { opacity: 0.5; }                         /* 지나간 슬롯 반투명 */
.fc-past .fc-event { cursor: default; }
.fc { min-width: 640px; }
@media (min-width: 768px) { .fc { min-width: 0; } }
`;
