"use client";

import { useMemo, useState, useTransition, useRef } from "react";
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
  const [view, setView] = useState<"day" | "week" | "month" | "year">("day");
  // 초기 Day 날짜: 오늘 수업이 있으면 오늘, 없으면 다음 예정 수업 날짜로 자동 점프
  const [dayDate, setDayDate] = useState<Date>(() => pickInitialDayDate(slots));
  const calRef = useRef<FullCalendar | null>(null);

  // Day 뷰 — 선택한 날짜 슬롯만 시간순 정렬
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
    <div>
      <style>{calendarStyles}</style>

      {/* Toolbar — prev/today/next + Day/Week/Month/Year 탭 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-sm">
          <button type="button" onClick={() => navigate("prev")} aria-label="이전"
            className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-50">◀</button>
          <button type="button" onClick={() => navigate("today")}
            className="rounded px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50">오늘</button>
          <button type="button" onClick={() => navigate("next")} aria-label="다음"
            className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-50">▶</button>
          {view === "day" && (
            <span className="ml-2 hidden text-sm font-semibold text-slate-700 sm:inline">
              {dayDate.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
            </span>
          )}
        </div>
        <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          {(["day", "week", "month", "year"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={"px-3 py-1.5 text-sm font-medium transition " +
                (view === v ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50")}>
              {v === "day" ? "Day" : v === "week" ? "Week" : v === "month" ? "Month" : "Year"}
            </button>
          ))}
        </div>
      </div>

      {view === "day" ? (
        <>
          {/* 카드 위 헤딩 — 오늘의 수업 / 예정된 수업 / 지난 수업 */}
          <div className="mb-3 flex items-baseline gap-3">
            <h3 className="text-lg font-bold text-slate-800">
              {dayLabelKo(dayDate, daySlots.length > 0)}
            </h3>
            <span className="text-xs text-slate-500">
              {dayDate.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
            </span>
          </div>
          <SlotCardListStudent slots={daySlots} onSelect={(s) => { setSelected(s); setMessage(null); }} />
        </>
      ) : (
        <div className="overflow-x-auto">
          <FullCalendar
            ref={calRef}
            key={view}
            plugins={[timeGridPlugin, dayGridPlugin, multiMonthPlugin, interactionPlugin]}
            initialView={
              view === "week" ? "timeGridWeek" :
              view === "month" ? "dayGridMonth" : "multiMonthYear"
            }
            headerToolbar={{ left: "", center: "title", right: "" }}
            buttonText={{ today: "오늘", week: "Week", month: "Month", year: "Year" }}
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
        </div>
      )}

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

        {/* 내가 신청한 온라인 수업 — Zoom / Teams 입장 버튼 */}
        {slot.i_am_booked && !isPast && slot.format === "online" && (slot.zoom_url || slot.teams_url) && (
          <div className="mt-4 flex flex-wrap gap-2 rounded-md border border-blue-200 bg-blue-50/40 p-3">
            <span className="self-center text-xs font-semibold text-slate-600">🎥 수업 입장:</span>
            {slot.zoom_url && (
              <a
                href={slot.zoom_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Zoom 열기 ↗
              </a>
            )}
            {slot.teams_url && (
              <a
                href={slot.teams_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-purple-700"
              >
                Teams 열기 ↗
              </a>
            )}
          </div>
        )}

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

/* ──────────────────────────────────────────────────────────────────────
   Day 초기 날짜 선택 — 오늘 수업이 있으면 오늘, 없으면 다음 예정 수업 날짜
   ────────────────────────────────────────────────────────────────────── */
function pickInitialDayDate(slots: BookableSlot[]): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const hasToday = slots.some((s) => {
    const t = new Date(s.start_at).getTime();
    return t >= today.getTime() && t < tomorrow.getTime();
  });
  if (hasToday) return today;

  const nowMs = Date.now();
  const upcoming = slots
    .map((s) => new Date(s.start_at).getTime())
    .filter((t) => t >= nowMs)
    .sort((a, b) => a - b);
  if (upcoming.length === 0) return today;
  const next = new Date(upcoming[0]);
  next.setHours(0, 0, 0, 0);
  return next;
}

/* ──────────────────────────────────────────────────────────────────────
   Day 헤딩 — 오늘의 수업 / 예정된 수업 / 지난 수업
   ────────────────────────────────────────────────────────────────────── */
function dayLabelKo(dayDate: Date, hasClasses: boolean): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dayDate);
  d.setHours(0, 0, 0, 0);
  const diff = d.getTime() - today.getTime();
  if (diff === 0) return hasClasses ? "오늘의 수업" : "오늘은 수업이 없습니다";
  if (diff > 0) return hasClasses ? "예정된 수업" : "이 날에는 수업이 없습니다";
  return hasClasses ? "지난 수업" : "이 날에는 수업이 없습니다";
}

/* ──────────────────────────────────────────────────────────────────────
   Day view — 교육생용 슬롯 카드 리스트
   ────────────────────────────────────────────────────────────────────── */
function SlotCardListStudent({
  slots,
  onSelect,
}: {
  slots: BookableSlot[];
  onSelect: (s: BookableSlot) => void;
}) {
  if (slots.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
        📭 이 날에는 등록된 수업이 없습니다.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {slots.map((s) => (
        <SlotCardStudent
          key={`${s.availability_id}|${s.start_at}`}
          slot={s}
          onClick={() => onSelect(s)}
        />
      ))}
    </div>
  );
}

function SlotCardStudent({
  slot,
  onClick,
}: {
  slot: BookableSlot;
  onClick: () => void;
}) {
  const start = new Date(slot.start_at);
  const end = new Date(slot.end_at);
  const now = Date.now();
  const isPast = slot.is_past;
  const isOngoing = start.getTime() <= now && end.getTime() > now;
  const isMine = slot.i_am_booked;
  const isFull = slot.booked_count >= slot.capacity && !isMine;
  const isClosed = slot.status === "closed";

  // 상태 라벨 + 색
  let statusLabel = "신청 가능";
  let statusClr = "bg-blue-100 text-blue-700";
  let borderClr = "border-slate-200";
  if (isPast) {
    statusLabel = isMine ? "완료된 수업" : "지난 시간";
    statusClr = "bg-slate-100 text-slate-500";
  } else if (isMine) {
    statusLabel = "내 수업";
    statusClr = "bg-emerald-100 text-emerald-700";
    borderClr = "border-emerald-300";
  } else if (isClosed) {
    statusLabel = "마감";
    statusClr = "bg-slate-100 text-slate-500";
  } else if (isFull) {
    statusLabel = "정원 마감";
    statusClr = "bg-amber-100 text-amber-700";
  }

  const timeFmt = (d: Date) =>
    d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "block w-full rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md " +
        (isOngoing
          ? "border-blue-400 ring-2 ring-blue-100"
          : isPast
          ? "border-slate-200 opacity-70"
          : borderClr)
      }
    >
      <div className="flex items-start gap-3">
        <div className="w-20 flex-shrink-0 text-center sm:w-24">
          <div className="text-base font-bold text-brand-700 sm:text-lg">{timeFmt(start)}</div>
          <div className="text-xs text-slate-400">{timeFmt(end)}</div>
        </div>

        <div className="min-w-0 flex-1 border-l border-slate-100 pl-3">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="truncate text-base font-bold text-slate-800">
              {isMine && <span className="mr-1 text-emerald-600">✓</span>}
              {slot.teacher_name} 강사
            </span>
            {isOngoing && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                ● 진행중
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {slot.class_type === "1on1" ? "1:1" : "그룹"}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {slot.format === "online" ? "💻 온라인" : "🏫 오프라인"}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {slot.booked_count}/{slot.capacity}명
            </span>
            <span className={"rounded-full px-2 py-0.5 text-[11px] font-medium " + statusClr}>
              {statusLabel}
            </span>
          </div>

          {/* 내가 신청한 온라인 수업 — Zoom / Teams 바로 들어가기 버튼 */}
          {isMine && !isPast && slot.format === "online" && (slot.zoom_url || slot.teams_url) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {slot.zoom_url && (
                <a
                  href={slot.zoom_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  🎥 Zoom 입장 ↗
                </a>
              )}
              {slot.teams_url && (
                <a
                  href={slot.teams_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-purple-700"
                >
                  💼 Teams 입장 ↗
                </a>
              )}
            </div>
          )}
        </div>

        <div className="self-center text-lg text-slate-300">›</div>
      </div>
    </button>
  );
}

const calendarStyles = `
.fc-event-inner { padding: 4px 6px; line-height: 1.3; height: 100%; display: flex; flex-direction: column; gap: 1px; overflow: hidden; }
.fc-event-time  { font-size: 0.72rem; opacity: 0.95; font-weight: 500; }
.fc-event-name  { font-size: 0.85rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fc-event-sub   { font-size: 0.68rem; opacity: 0.9; }
.fc-mine .fc-event-name { font-weight: 700; }
.fc-mine-check { font-weight: 700; }
.fc-event { cursor: pointer; }
.fc-past { opacity: 0.5; }                         /* 지나간 슬롯 반투명 */
.fc-past .fc-event { cursor: default; }
/* 슬롯 높이 확대 — 시간/이름/타입 모두 한눈에 보이도록 */
.fc .fc-timegrid-slot { height: 3em !important; }
.fc .fc-timegrid-slot-minor { border-top-style: dotted; }
.fc-timegrid-event { min-height: 3em; }
.fc-timegrid-event .fc-event-main { padding: 0 !important; }
.fc { min-width: 640px; }
@media (min-width: 768px) { .fc { min-width: 0; } }
`;
