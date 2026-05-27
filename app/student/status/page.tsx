import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import StudentTeacherFeedbackForm from "@/components/StudentTeacherFeedbackForm";

export const dynamic = "force-dynamic";

export default async function StudentStatusPage() {
  const profile = await requireRole(["student", "admin"]);
  const supabase = createClient();

  // 본인 모든 예약
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, slot_id, start_at, end_at, status, created_at, cancelled_at")
    .eq("student_id", profile.id)
    .order("start_at", { ascending: true });

  const all = bookings ?? [];
  const confirmed = all.filter((b: any) => b.status === "confirmed");
  const cancelled = all.filter((b: any) => b.status === "cancelled");
  const now = new Date();
  const upcoming = confirmed.filter((b: any) => new Date(b.end_at) > now);
  const past = confirmed.filter((b: any) => new Date(b.end_at) <= now);

  // 강좌(enrollment) 정보 (profiles 컬럼에서 직접)
  const totalSessions = profile.course_total_sessions ?? null;
  const remaining = totalSessions == null
    ? null
    : Math.max(0, totalSessions - confirmed.length);

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

  // 출석률 = 출석(present+late) / (present + late + absent) * 100
  // reschedule, other 는 분자/분모 모두에서 제외
  let presentCount = 0, lateCount = 0, absentCount = 0;
  for (const b of past) {
    const status = attendanceByBooking.get(b.id);
    if (status === "present") presentCount++;
    else if (status === "late") lateCount++;
    else if (status === "absent") absentCount++;
  }
  const attendedCount = presentCount + lateCount;
  const markedTotal = presentCount + lateCount + absentCount;
  const attendanceRate = markedTotal === 0
    ? null
    : Math.round((attendedCount / markedTotal) * 100);

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

  const hasEnrollment = !!profile.course_name;

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
          <h2 className="mb-3 text-sm font-semibold text-slate-700">📚 강좌 정보</h2>
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
                label="출석률"
                value={
                  attendanceRate != null
                    ? `${attendanceRate}% (출석 ${attendedCount}/${markedTotal})`
                    : markedTotal === 0 && past.length > 0
                      ? "강사 체크 대기 중"
                      : "—"
                }
                accent="text-emerald-700"
              />
            </div>
          )}
        </section>

        {/* 강사 평가 — 배정 강사가 있을 때만 */}
        {profile.assigned_teacher_id && assignedTeacherName && (
          <section className="card mb-6">
            <StudentTeacherFeedbackForm
              teacherId={profile.assigned_teacher_id}
              teacherName={assignedTeacherName}
              initialRating={existingTeacherFeedback?.rating ?? null}
              initialComment={existingTeacherFeedback?.comment ?? null}
            />
          </section>
        )}

        {/* 진행률 바 */}
        {totalSessions != null && totalSessions > 0 && (
          <section className="card mb-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">진행률</span>
              <span className="text-slate-500">
                {confirmed.length} / {totalSessions} ({Math.round((confirmed.length / totalSessions) * 100)}%)
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(100, (confirmed.length / totalSessions) * 100)}%` }}
              />
            </div>
          </section>
        )}

        {/* 다가오는 수업 */}
        <section className="card mb-6">
          <h2 className="mb-3 font-semibold">📅 다가오는 수업 ({upcoming.length})</h2>
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
          <h2 className="mb-3 font-semibold">📖 지난 수업 ({past.length})</h2>
          {past.length === 0 ? (
            <p className="text-sm text-slate-400">완료된 수업이 없습니다.</p>
          ) : (
            <BookingList items={past} slotInfo={slotInfo} attendance={attendanceByBooking} muted />
          )}
        </section>

        {cancelled.length > 0 && (
          <section className="card mt-6 opacity-80">
            <h2 className="mb-3 font-semibold text-slate-500">❌ 취소된 수업 ({cancelled.length})</h2>
            <BookingList items={cancelled} slotInfo={slotInfo} muted />
          </section>
        )}
      </main>
    </>
  );
}

function InfoRow({
  label, value, accent,
}: {
  label: string;
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
                })}
                {" ~ "}
                {end.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}
              </div>
              <div className="text-xs text-slate-500">
                {info?.teacher ?? "—"} 강사
                {info && (
                  <>
                    {" · "}
                    {info.class_type === "1on1" ? "1:1" : "그룹"}
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
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}
