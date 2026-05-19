"use client";

import { useState } from "react";
import type { TimeSlot } from "@/lib/types";
import TeacherScheduleEditor from "@/components/TeacherScheduleEditor";
import ClassSchedulesView, { type BookingEvent } from "@/components/ClassSchedulesView";

type Tab = "availability" | "schedules";

export default function TeacherScheduleTabs({
  slots,
  bookingCounts,
  bookingEvents,
}: {
  slots: TimeSlot[];
  bookingCounts: Record<string, number>;
  bookingEvents: BookingEvent[];
}) {
  const [tab, setTab] = useState<Tab>("schedules");

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        <TabBtn active={tab === "schedules"} onClick={() => setTab("schedules")}>
          📚 Class Schedules
        </TabBtn>
        <TabBtn active={tab === "availability"} onClick={() => setTab("availability")}>
          🗓️ Availability
        </TabBtn>
      </div>

      {tab === "schedules" && <ClassSchedulesView events={bookingEvents} />}
      {tab === "availability" && (
        <TeacherScheduleEditor slots={slots} bookingCounts={bookingCounts} />
      )}
    </div>
  );
}

function TabBtn({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition " +
        (active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-700")
      }
    >
      {children}
    </button>
  );
}
