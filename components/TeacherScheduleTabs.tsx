"use client";

import { useState } from "react";
import type { TimeSlot } from "@/lib/types";
import TeacherScheduleEditor from "@/components/TeacherScheduleEditor";
import ClassSchedulesView, { type BookingEvent, type ClassSlotEvent } from "@/components/ClassSchedulesView";
import TeacherCoursesView, { type TeacherCourse } from "@/components/TeacherCoursesView";

type Tab = "availability" | "schedules" | "courses";

export default function TeacherScheduleTabs({
  slots,
  bookingCounts,
  bookingEvents,
  classSlots,
  courses,
  availabilityLocked = false,
  lang = "en",
}: {
  slots: TimeSlot[];
  bookingCounts: Record<string, number>;
  bookingEvents: BookingEvent[];
  classSlots: ClassSlotEvent[];
  courses: TeacherCourse[];
  /** 센터가 과정·시간표를 배정하는 강사 — Availability 입력 비활성화 */
  availabilityLocked?: boolean;
  lang?: "en" | "ko";
}) {
  const [tab, setTab] = useState<Tab>("schedules");
  const L = lang === "ko"
    ? { schedules: "수업 일정", courses: "과정 정보", availability: "가능 시간", lockedTip: "센터가 시간표를 배정하는 강사는 가능 시간 입력이 비활성화됩니다." }
    : { schedules: "Class Schedules", courses: "Course Information", availability: "Availability", lockedTip: "Your schedule is assigned by the center — availability input is disabled." };

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        <TabBtn active={tab === "schedules"} onClick={() => setTab("schedules")}>
          {L.schedules}
        </TabBtn>
        <TabBtn active={tab === "courses"} onClick={() => setTab("courses")}>
          {L.courses}
        </TabBtn>
        {availabilityLocked ? (
          <span
            className="-mb-px cursor-not-allowed border-b-2 border-transparent px-4 py-2 text-sm font-medium text-slate-300"
            title={L.lockedTip}
          >
            {L.availability}
          </span>
        ) : (
          <TabBtn active={tab === "availability"} onClick={() => setTab("availability")}>
            {L.availability}
          </TabBtn>
        )}
      </div>

      {tab === "schedules" && (
        <ClassSchedulesView events={bookingEvents} classSlots={classSlots} lang={lang} />
      )}
      {tab === "availability" && !availabilityLocked && (
        <TeacherScheduleEditor slots={slots} bookingCounts={bookingCounts} />
      )}
      {tab === "courses" && <TeacherCoursesView courses={courses} lang={lang} />}
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
