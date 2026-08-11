"use client";

import { useState, type ReactNode } from "react";

// KST 기준으로 계산된 주간 반복 패턴 (요일/시각/길이)
export interface CoursePattern {
  weekday: number; // 0=Sun … 6=Sat (KST)
  time: string; // "HH:mm" (KST)
  duration_min: number;
  count: number; // 이 패턴에 해당하는 세션 수
}

// 강사에게 배정된 "강좌" 1건. 정식 courses 엔티티가 생기기 전까지는
// 예약(bookings) + 교육생 프로필에서 유도한다. course_code/name/language 는
// 아직 DB에 없어 null(→ "—") 로 둔다.
export interface TeacherCourse {
  student_id: string;
  student_name: string;
  company: string | null;
  course_code: string | null;
  course_name: string | null;
  language: string | null;
  class_types: string[]; // 예: ["1on1"]
  formats: string[]; // 예: ["online"]
  period_start: string | null; // ISO
  period_end: string | null; // ISO
  sessions_count: number;
  patterns: CoursePattern[];
}

const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const CLASS_TYPE_LABEL: Record<string, string> = {
  "1on1": "1:1",
  small_group: "Small Group",
};
const FORMAT_LABEL: Record<string, string> = {
  online: "Online",
  offline: "Offline",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

/**
 * "Course Information" 탭 — 강사에게 배정된 강좌 목록.
 * 목록 항목을 누르면 카드가 아코디언으로 펼쳐진다. 여러 개를 동시에 열어둘 수
 * 있고(다른 항목을 열어도 기존 것은 유지), 닫는 것은 해당 항목을 다시 눌러 수동으로.
 */
export default function TeacherCoursesView({
  courses,
}: {
  courses: TeacherCourse[];
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (courses.length === 0) {
    return (
      <div className="card text-sm text-slate-500">
        No courses assigned yet. Courses will appear here once students are
        booked into your classes (or once the center assigns you to a course).
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">
        {courses.length} course{courses.length > 1 ? "s" : ""} — click a course
        to expand. Multiple can stay open; click again to close.
      </p>

      {courses.map((c) => {
        const open = openIds.has(c.student_id);
        const title = c.course_name ?? c.student_name;
        return (
          <div
            key={c.student_id}
            className="overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <button
              onClick={() => toggle(c.student_id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">
                  {c.course_code ?? "—"}
                </span>
                <span className="truncate font-medium text-slate-800">
                  {title}
                </span>
                {c.company && (
                  <span className="truncate text-xs text-slate-400">
                    · {c.company}
                  </span>
                )}
              </div>
              <span className="shrink-0 text-xs text-slate-400">
                {open ? "▲ Close" : "▼ Open"}
              </span>
            </button>

            {open && (
              <div className="border-t border-slate-100 px-4 py-4 text-sm">
                <div className="mb-3 flex flex-wrap gap-2">
                  {(c.class_types.length ? c.class_types : ["—"]).map((t) => (
                    <Badge key={t}>{CLASS_TYPE_LABEL[t] ?? t}</Badge>
                  ))}
                  {c.formats.map((f) => (
                    <Badge key={f} tone="blue">
                      {FORMAT_LABEL[f] ?? f}
                    </Badge>
                  ))}
                </div>

                <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-[150px_1fr]">
                  <Row label="Course Code" value={c.course_code ?? "—"} />
                  <Row label="Course Name" value={c.course_name ?? "—"} />
                  <Row label="Company" value={c.company ?? "—"} />
                  <Row label="Language" value={c.language ?? "—"} />
                  <Row
                    label="Class Type"
                    value={
                      c.class_types.map((t) => CLASS_TYPE_LABEL[t] ?? t).join(", ") ||
                      "—"
                    }
                  />
                  <Row
                    label="Format"
                    value={
                      c.formats.map((f) => FORMAT_LABEL[f] ?? f).join(", ") || "—"
                    }
                  />
                  <Row
                    label="Class Period"
                    value={`${fmtDate(c.period_start)} – ${fmtDate(c.period_end)}`}
                  />
                  <Row label="Total Sessions" value={String(c.sessions_count)} />
                  <Row
                    label="Days & Time"
                    value={
                      c.patterns.length ? (
                        <ul className="space-y-0.5">
                          {c.patterns.map((p, i) => (
                            <li key={i}>
                              {WEEKDAYS[p.weekday]} · {p.time} · {p.duration_min} min
                              {p.count > 1 ? ` (×${p.count})` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      )
                    }
                  />
                </dl>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="text-slate-700">{value}</dd>
    </>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "blue";
}) {
  const cls =
    tone === "blue"
      ? "bg-brand-50 text-brand-700"
      : "bg-slate-100 text-slate-600";
  return (
    <span className={"rounded-full px-2.5 py-0.5 text-xs font-medium " + cls}>
      {children}
    </span>
  );
}
