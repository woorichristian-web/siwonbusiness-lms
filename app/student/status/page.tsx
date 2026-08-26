import Link from "next/link";
import { classTypeKo } from "@/lib/types";
import { requireRole } from "@/lib/auth";
import { getTestCourseIds } from "@/lib/testCourses";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import StudentTeacherFeedbackForm from "@/components/StudentTeacherFeedbackForm";
import HelpTooltip from "@/components/HelpTooltip";
import CurriculumManager, { type CurriculumItem } from "@/components/CurriculumManager";
import { SurveyButton, type PendingSurvey } from "@/components/SurveyPopup";
import { openRounds, teacherEvalRounds } from "@/lib/survey";

const ATTENDANCE_HELP =
  "• 업무를 위한 결석인 경우는 출석율에 영향을 미치지 않으나 자료제출이 필수입니다.\n" +
  "• 수업시간 조정은 강사에게 직접 연락하세요.\n" +
  "• 기타 문의는 b2b@siwonschool.com 으로 연락주세요.";

export const dynamic = "force-dynamic";

export default async function StudentStatusPage() {
  const profile = await requireRole(["student", "admin"]);
  const supabase = createClient();

  // 본인 모든 예약 — 테스트 과정 소속 예약은 숨김
  const [{ data: bookings }, testIds] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, slot_id, start_at, end_at, status, created_at, cancelled_at, course_id")
      .eq("student_id", profile.id)
      .order("start_at", { ascending: true }),
    getTestCourseIds(supabase),
  ]);

  const all = (bookings ?? []).filter(
    (b: any) => !b.course_id || !testIds.has(b.course_id),
  );
  const confirmed = all.filter((b: any) => b.status === "confirmed");
  const cancelled = all.filter((b: any) => b.status === "cancelled");
  const now = new Date();
  const upcoming = confirmed.filter((b: any) => new Date(b.end_at) > now);
  const past = confirmed.filter((b: any) => new Date(b.end_at) <= now);

  // 강좌(enrollment) 정보 (profiles 컬럼에서 직접)
  // 남은 강좌수·진행률은 이미 지난 수업만 차감 — 예약만 되어 있고 아직 안 한 수업은 남은 것으로 센다.
  const totalSessions = profile.course_total_sessions ?? null;
  const remaining = totalSessions == null
    ? null
    : Math.max(0, totalSessions - past.length);

  // 실제 출석 기록 조회 (5가지 상태)
  type AttStatus = "present" | "late" | "absent" | "reschedule" | "other";
  const attendanceByBooking = new Map<string, AttStatus>();
  const pastBookingIds = past.map((b: any) => b.id);
  if (pastBookingIds.length > 0) {
    const { data: atts } = await supabase
      .from("attendance")
      .select("booking_id, status")
      .in("booking_id", pastBookingIds);
    for (const a of atts ?? []) {
      attendanceByBooking.set(a.booking_id, a.status as any);
    }
  }

  // 출석률 = 실제 참여한 수업(정시+지각) / 지금까지 한 수업 × 100
  // 리스케줄·기타(업무 결석)는 진행된 수업으로 치지 않아 분모에서 제외.
  // 아직 강사가 체크하지 않은 지난 수업은 분모에 포함 — 강사가 체크하면 출석률이 올라간다.
  let presentCount = 0, lateCount = 0, rescheduleCount = 0, otherCount = 0;
  for (const b of past) {
    const status = attendanceByBooking.get(b.id);
    if (status === "present") presentCount++;
    else if (status === "late") lateCount++;
    else if (status === "reschedule") rescheduleCount++;
    else if (status === "other") otherCount++;
  }
  const attendedCount = presentCount + lateCount;
  const heldTotal = past.length - rescheduleCount - otherCount;
  const attendanceRate = heldTotal <= 0
    ? null
    : Math.round((attendedCount / heldTotal) * 100);

  // 배정 강사
  let assignedTeacherName: string | null = null;
  if (profile.assigned_teacher_id) {
    const { data: t } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", profile.assigned_teacher_id)
      .maybeSingle();
    assignedTeacherName = t?.name ?? null;
  }

  // 기존 강사 평가 (교육생→강사) — 폼에 미리 채우기 위해
  let existingTeacherFeedback: { rating: number | null; comment: string | null } | null = null;
  if (profile.assigned_teacher_id) {
    const { data: stf } = await supabase
      .from("student_teacher_feedback")
      .select("rating, comment")
      .eq("student_id", profile.id)
      .eq("teacher_id", profile.assigned_teacher_id)
      .maybeSingle();
    existingTeacherFeedback = stf ?? null;
  }

  // 슬롯 상세 (강사명, 형식)
  const slotIds = Array.from(new Set(confirmed.map((b: any) => b.slot_id)));
  const slotInfo = new Map<string, { teacher: string; format: string; class_type: string }>();
  if (slotIds.length > 0) {
    const { data: slots } = await supabase
      .from("time_slots")
      .select("id, teacher_id, format, class_type")
      .in("id", slotIds);
    const teacherIds = Array.from(new Set((slots ?? []).map((s: any) => s.teacher_id)));
    const tMap = new Map<string, string>();
    if (teacherIds.length > 0) {
      const { data: ts } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", teacherIds);
      for (const t of ts ?? []) tMap.set(t.id, t.name);
    }
    for (const s of slots ?? []) {
      slotInfo.set(s.id, {
        teacher: tMap.get(s.teacher_id) ?? "이름 없음",
        format: s.format,
        class_type: s.class_type,
      });
    }
  }

  // 배정 강사 미지정 시 — 확정 예약에서 가장 많이 만나는 강사를 담당 강사로 표시
  if (!assignedTeacherName && confirmed.length > 0) {
    const counts = new Map<string, number>();
    for (const b of confirmed) {
      const t = slotInfo.get(b.slot_id)?.teacher;
      if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    assignedTeacherName =
      Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  const hasEnrollment = !!profile.course_name;

  // 강사 평가 활성화 기간 — 4주차 / 50% 경과 / 마지막 수업일 (각 7일)
  const evalRounds = teacherEvalRounds(
    profile.course_start_date ?? null,
    profile.course_end_date ?? null,
  );
  const evalNow = new Date();
  const evalRoundOpen = evalRounds.some((r) => evalNow >= r.open && evalNow < r.close);
  const nextEvalRound = evalRounds.find((r) => evalNow < r.open) ?? null;

  // 수강 과정 커리큘럼 (읽기 전용)
  const { data: myCs } = await supabase
    .from("course_students")
    .select("course_id")
    .eq("student_id", profile.id);
  const myCourseIds = Array.from(new Set((myCs ?? []).map((r: any) => r.course_id)))
    .filter((id) => !testIds.has(id)); // 테스트 과정 숨김

  // 응답 기간 중인 만족도 설문 — [수업후기 쓰기] 버튼용 (팝업과 동일한 예외로 테스트 과정 포함)
  const surveyCourseIds = Array.from(new Set((myCs ?? []).map((r: any) => r.course_id)));
  const pendingSurveys: PendingSurvey[] = [];
  if (surveyCourseIds.length > 0) {
    const [{ data: svCs }, { data: svResp }] = await Promise.all([
      supabase.from("courses").select("id, name, start_date, end_date").in("id", surveyCourseIds),
      supabase.from("survey_responses").select("course_id, round")
        .eq("student_id", profile.id).in("course_id", surveyCourseIds),
    ]);
    const done = new Set((svResp ?? []).map((r: any) => `${r.course_id}|${r.round}`));
    for (const c of svCs ?? [])
      for (const r of openRounds(c.start_date, c.end_date))
        if (!done.has(`${c.id}|${r.round}`))
          pendingSurveys.push({
            courseId: c.id, courseName: c.name,
            round: r.round, label: r.label, closeDate: r.close.toISOString(),
          });
  }
  let curricula: {
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
    curricula = (cs ?? []).map((c: any) => ({
      id: c.id, name: c.name, curriculum_updated_at: c.curriculum_updated_at,
      items: byCourse.get(c.id) ?? [],
    }));
  }

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">수강 현황</h1>
          <p className="text-sm text-slate-500">{profile.name}님의 수강 진행 상태입니다.</p>
        </header>

        {/* 강좌 요약 카드 */}
        <section className="card mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">강좌 정보</h2>
          {!hasEnrollment ? (
            <p className="text-sm text-slate-400">
              아직 배정된 강좌가 없습니다. 관리자에게 문의해주세요.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow label="수강 강좌명" value={profile.course_name!} />
              <InfoRow
                label="수강 기간"
                value={
                  profile.course_start_date && profile.course_end_date
                    ? `${formatDate(profile.course_start_date)} ~ ${formatDate(profile.course_end_date)}`
                    : profile.course_start_date
                      ? `${formatDate(profile.course_start_date)} ~`
                      : profile.course_end_date
                        ? `~ ${formatDate(profile.course_end_date)}`
                        : "—"
                }
              />
              <InfoRow label="담당 강사" value={assignedTeacherName ?? "미배정"} />
              <InfoRow label="총 강좌수" value={totalSessions != null ? `${totalSessions}차시` : "—"} />
              <InfoRow
                label="남은 강좌수"
                value={remaining != null ? `${remaining}차시` : "—"}
                accent="text-amber-700"
              />
              <InfoRow
                label={
                  <span className="inline-flex items-center gap-1">
                    출석률
                    <HelpTooltip text={ATTENDANCE_HELP} />
                  </span>
                }
                value={
                  attendanceRate != null
                    ? `${attendanceRate}% (참여 ${attendedCount}/${heldTotal})`
                    : "—"
                }
                accent="text-emerald-700"
              />
            </div>
          )}
        </section>

        {/* 강사 평가 — 4주차 / 과정 50% 경과 / 마지막 수업일에만 7일간 활성화 */}
        {profile.assigned_teacher_id && assignedTeacherName && evalRounds.length > 0 && (
          evalRoundOpen ? (
            <section className="card mb-6">
              <StudentTeacherFeedbackForm
                teacherId={profile.assigned_teacher_id}
                teacherName={assignedTeacherName}
                initialRating={existingTeacherFeedback?.rating ?? null}
                initialComment={existingTeacherFeedback?.comment ?? null}
              />
            </section>
          ) : (
            <section className="card mb-6">
              <h2 className="text-sm font-semibold text-slate-700">강사 평가</h2>
              <p className="mt-1 text-sm text-slate-500">
                강사 평가는 <b>4주차</b>, <b>과정 50% 경과 시점</b>, <b>마지막 수업일</b>에 각 7일간 열립니다.
                {nextEvalRound
                  ? ` 다음 평가 기간: ${nextEvalRound.open.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" })}부터 7일간`
                  : " 이번 과정의 평가 기간이 모두 종료되었습니다."}
              </p>
            </section>
          )
        )}

        {/* 진행률 바 */}
        {totalSessions != null && totalSessions > 0 && (
          <section className="card mb-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">진행률</span>
              <span className="text-slate-500">
                {past.length} / {totalSessions} ({Math.round((past.length / totalSessions) * 100)}%)
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(100, (past.length / totalSessions) * 100)}%` }}
              />
            </div>
          </section>
        )}

        {/* 다가오는 수업 */}
        <section className="card mb-6">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="font-semibold">다가오는 수업 ({upcoming.length})</h2>
            <SurveyButton surveys={pendingSurveys} />
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-400">
              예약된 수업이 없습니다.{" "}
              <Link href="/student/calendar" className="text-brand-600 hover:underline">
                신청하기 →
              </Link>
            </p>
          ) : (
            <BookingList items={upcoming} slotInfo={slotInfo} />
          )}
        </section>

        {/* 지난 수업 */}
        <section className="card">
          <h2 className="mb-3 font-semibold">지난 수업 ({past.length})</h2>
          {past.length === 0 ? (
            <p className="text-sm text-slate-400">완료된 수업이 없습니다.</p>
          ) : (
            <BookingList items={past} slotInfo={slotInfo} attendance={attendanceByBooking} muted />
          )}
        </section>

        {cancelled.length > 0 && (
          <section className="card mt-6 opacity-80">
            <h2 className="mb-3 font-semibold text-slate-500">취소된 수업 ({cancelled.length})</h2>
            <BookingList items={cancelled} slotInfo={slotInfo} muted />
          </section>
        )}

        {curricula.map((c) => (
          <div key={c.id} className="mt-6">
            <CurriculumManager
              courseId={c.id}
              courseName={c.name}
              rows={c.items}
              canEdit={false}
              updatedAt={c.curriculum_updated_at}
            />
          </div>
        ))}
      </main>
    </>
  );
}

function InfoRow({
  label, value, accent,
}: {
  label: React.ReactNode;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={"mt-1 text-base font-bold " + (accent ?? "text-slate-800")}>
        {value}
      </div>
    </div>
  );
}

function BookingList({
  items, slotInfo, attendance, muted,
}: {
  items: any[];
  slotInfo: Map<string, { teacher: string; format: string; class_type: string }>;
  attendance?: Map<string, "present" | "late" | "absent" | "reschedule" | "other">;
  muted?: boolean;
}) {
  const attLabel: Record<string, { text: string; cls: string }> = {
    present: { text: "출석", cls: "bg-emerald-100 text-emerald-700" },
    late: { text: "지각", cls: "bg-amber-100 text-amber-700" },
    absent: { text: "결석", cls: "bg-red-100 text-red-700" },
    reschedule: { text: "일정 변경", cls: "bg-blue-100 text-blue-700" },
    other: { text: "기타", cls: "bg-slate-100 text-slate-700" },
  };
  return (
    <ul className={"divide-y divide-slate-100 text-sm " + (muted ? "opacity-70" : "")}>
      {items.map((b) => {
        const info = slotInfo.get(b.slot_id);
        const start = new Date(b.start_at);
        const end = new Date(b.end_at);
        const att = attendance?.get(b.id);
        return (
          <li key={b.id} className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium">
                {start.toLocaleString("ko-KR", {
                  year: "numeric", month: "2-digit", day: "2-digit",
                  weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
                  timeZone: "Asia/Seoul",
                })}
                {" ~ "}
                {end.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" })}
              </div>
              <div className="text-xs text-slate-500">
                {info?.teacher ?? "—"} 강사
                {info && (
                  <>
                    {" · "}
                    {classTypeKo(info.class_type)}
                    {" · "}
                    {info.format === "online" ? "온라인" : "오프라인"}
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {att && attLabel[att] && (
                <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + attLabel[att].cls}>
                  {attLabel[att].text}
                </span>
              )}
              <span className={
                "rounded-full px-2 py-0.5 text-xs " +
                (b.status === "cancelled" ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700")
              }>
                {b.status === "cancelled" ? "취소됨" : "확정"}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" });
}
