import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import ClassManageView, { type ClassRow } from "@/components/ClassManageView";
import CurriculumManager, { type CurriculumItem } from "@/components/CurriculumManager";
import TeacherAssessmentView, { type AssessmentCourseData } from "@/components/TeacherAssessmentView";
import { getTestCourseIds } from "@/lib/testCourses";
import { getTeacherLang } from "@/lib/teacherLang";

export const dynamic = "force-dynamic";

const WD_KO: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };
const WD_EN: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export default async function TeacherClassManagePage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const profile = await requireRole(["teacher", "admin"]);
  const supabase = createClient();
  const lang = getTeacherLang();
  const tab =
    searchParams.tab === "curriculum" ? "curriculum"
    : searchParams.tab === "assessment" ? "assessment"
    : "courses";

  // Teacher's slots — 테스트 과정 소속 슬롯은 숨김
  const [{ data: slotsAll }, testIds] = await Promise.all([
    supabase
      .from("time_slots")
      .select("id, class_type, format, course_id")
      .eq("teacher_id", profile.id),
    getTestCourseIds(supabase),
  ]);
  const slots = (slotsAll ?? []).filter(
    (s: any) => !s.course_id || !testIds.has(s.course_id),
  );
  const slotById = new Map<string, any>();
  for (const s of slots ?? []) slotById.set(s.id, s);
  const slotIds = (slots ?? []).map((s: any) => s.id);

  // Confirmed bookings on this teacher's slots
  let bookingsRaw: any[] = [];
  if (slotIds.length > 0) {
    const { data: b } = await supabase
      .from("bookings")
      .select("id, slot_id, student_id, start_at, end_at, status")
      .in("slot_id", slotIds)
      .eq("status", "confirmed");
    bookingsRaw = b ?? [];
  }

  // Students
  const studentIds = Array.from(new Set(bookingsRaw.map((b) => b.student_id)));
  const studentById = new Map<string, any>();
  if (studentIds.length > 0) {
    const { data: students } = await supabase
      .from("profiles")
      .select("id, name, english_name, username, company_name, course_name")
      .in("id", studentIds);
    for (const s of students ?? []) studentById.set(s.id, s);
  }

  // Attendance
  const bookingIds = bookingsRaw.map((b) => b.id);
  const attendanceByBooking = new Map<string, "present" | "absent" | "late" | "reschedule" | "other">();
  const attendanceNotesByBooking = new Map<string, string | null>();
  if (bookingIds.length > 0) {
    const { data: atts } = await supabase
      .from("attendance")
      .select("booking_id, status, notes")
      .in("booking_id", bookingIds);
    for (const a of atts ?? []) {
      attendanceByBooking.set(a.booking_id, a.status as any);
      attendanceNotesByBooking.set(a.booking_id, a.notes ?? null);
    }
  }

  // Feedback (full rows so we can re-open the modal with existing values)
  const feedbackByBooking = new Map<string, any>();
  if (bookingIds.length > 0) {
    const { data: fbs } = await supabase
      .from("feedback")
      .select("*")
      .in("booking_id", bookingIds);
    for (const f of fbs ?? []) feedbackByBooking.set(f.booking_id, f);
  }

  // Build class rows
  const classRows: ClassRow[] = bookingsRaw.map((b) => {
    const s = studentById.get(b.student_id);
    const slot = slotById.get(b.slot_id);
    const fb = feedbackByBooking.get(b.id);
    return {
      booking_id: b.id,
      slot_id: b.slot_id,
      start_at: b.start_at,
      end_at: b.end_at,
      student_id: b.student_id,
      // 강사에게는 영문 이름을 우선 표시 (없으면 한글 이름)
      student_name: s?.english_name?.trim() || s?.name || "Unknown",
      student_username: s?.username ?? "",
      student_company: s?.company_name ?? null,
      course_name: s?.course_name ?? null,
      class_type: slot?.class_type ?? "1on1",
      format: slot?.format ?? "online",
      attendance: attendanceByBooking.get(b.id) ?? null,
      attendance_notes: attendanceNotesByBooking.get(b.id) ?? null,
      feedback: fb ?? null,
    };
  });

  // 담당 과정 + 커리큘럼 (강사가 확인·업로드)
  const { data: myCts } = await supabase
    .from("course_teachers")
    .select("course_id")
    .eq("teacher_id", profile.id)
    .is("assigned_until", null);
  const myCourseIds = Array.from(new Set((myCts ?? []).map((r: any) => r.course_id)))
    .filter((id) => !testIds.has(id)); // 테스트 과정 숨김
  let myCourses: {
    id: string; name: string; curriculum_updated_at: string | null; items: CurriculumItem[];
  }[] = [];
  if (myCourseIds.length > 0) {
    const [{ data: cs }, { data: cur }] = await Promise.all([
      supabase.from("courses").select("id, name, curriculum_updated_at").in("id", myCourseIds),
      supabase
        .from("course_curriculum")
        .select("course_id, session_no, session_date, topic, details, materials, sort_order")
        .in("course_id", myCourseIds)
        .order("sort_order", { ascending: true }),
    ]);
    const byCourse = new Map<string, CurriculumItem[]>();
    for (const r of cur ?? [])
      (byCourse.get(r.course_id) ?? byCourse.set(r.course_id, []).get(r.course_id)!).push({
        session_no: r.session_no, session_date: r.session_date, topic: r.topic,
        details: r.details, materials: r.materials,
      });
    myCourses = (cs ?? []).map((c: any) => ({
      id: c.id, name: c.name, curriculum_updated_at: c.curriculum_updated_at,
      items: byCourse.get(c.id) ?? [],
    }));
  }

  // ── Assessment 탭 데이터 — 과정별 등록 학생 + 저장된 평가 (강사·센터 전용) ──
  let assessmentCourses: AssessmentCourseData[] = [];
  if (tab === "assessment" && myCourseIds.length > 0) {
    const [{ data: courseRows }, { data: enrolls }, { data: assess }] = await Promise.all([
      supabase
        .from("courses")
        .select("id, name, weekdays, class_time, day_times, duration_min")
        .in("id", myCourseIds),
      supabase.from("course_students").select("course_id, student_id").in("course_id", myCourseIds),
      // 0036 미적용 시 에러가 나지만 조용히 빈 목록으로 처리
      supabase
        .from("teacher_assessments")
        .select("course_id, student_id, phase, scores, comment")
        .in("course_id", myCourseIds),
    ]);
    const sIds = Array.from(new Set((enrolls ?? []).map((r: any) => r.student_id)));
    const sName = new Map<string, { name: string; company: string | null }>();
    if (sIds.length > 0) {
      const { data: sps } = await supabase
        .from("profiles").select("id, name, english_name, company_name").in("id", sIds);
      for (const p of sps ?? [])
        sName.set(p.id, { name: (p.english_name?.trim() || p.name) as string, company: p.company_name ?? null });
    }
    assessmentCourses = (courseRows ?? []).map((c: any) => {
      const WD = lang === "ko" ? WD_KO : WD_EN;
      const days = (c.weekdays ?? []) as string[];
      const timeOf = (d: string) =>
        String(c.day_times?.[d] ?? c.class_time ?? "").slice(0, 5);
      const sched = days.length > 0
        ? days.map((d) => `${WD[d] ?? d} ${timeOf(d)}`.trim()).join(" · ")
          + (c.duration_min ? ` · ${c.duration_min}${lang === "ko" ? "분" : "min"}` : "")
        : "—";
      const students = (enrolls ?? [])
        .filter((r: any) => r.course_id === c.id)
        .map((r: any) => ({
          id: r.student_id,
          name: sName.get(r.student_id)?.name ?? "—",
          company: sName.get(r.student_id)?.company ?? null,
        }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
      const records: AssessmentCourseData["records"] = {};
      for (const a of assess ?? []) {
        if (a.course_id !== c.id) continue;
        (records[a.student_id] ??= {})[a.phase as "initial" | "final"] = {
          scores: (a.scores ?? {}) as Record<string, number>,
          comment: a.comment ?? null,
        };
      }
      return { id: c.id, name: c.name, schedule: sched, students, records };
    });
  }

  const TABS = [
    { key: "courses", href: "/teacher/class-manage", ko: "전체 수업", en: "All Courses" },
    { key: "curriculum", href: "/teacher/class-manage?tab=curriculum", ko: "커리큘럼", en: "Curriculum" },
    { key: "assessment", href: "/teacher/class-manage?tab=assessment", ko: "평가", en: "Assessment" },
  ] as const;

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-4">
          <h1 className="text-xl font-bold text-slate-800">{lang === "ko" ? "수업 관리" : "Management"}</h1>
          <p className="text-sm text-slate-500">
            {lang === "ko"
              ? "미평가 수업을 먼저 처리하고, 과정별로 출석과 피드백을 입력하세요."
              : "Handle pending evaluations first, then mark attendance and feedback for each course."}
          </p>
        </header>

        {/* 하위 탭 — All Courses / Curriculum / Assessment */}
        <div className="mb-5 flex overflow-x-auto border-b border-slate-200">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={
                "whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition " +
                (tab === t.key
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-700")
              }
            >
              {lang === "ko" ? t.ko : t.en}
            </Link>
          ))}
        </div>

        {tab === "courses" && <ClassManageView rows={classRows} lang={lang} />}

        {tab === "curriculum" && (
          myCourses.length > 0 ? (
            <div className="space-y-4">
              {myCourses.map((c) => (
                <CurriculumManager
                  key={c.id}
                  courseId={c.id}
                  courseName={c.name}
                  rows={c.items}
                  canEdit
                  updatedAt={c.curriculum_updated_at}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
              {lang === "ko" ? "담당 중인 과정이 없습니다." : "No assigned courses yet."}
            </div>
          )
        )}

        {tab === "assessment" && (
          <TeacherAssessmentView courses={assessmentCourses} lang={lang} />
        )}
      </main>
    </>
  );
}
