import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import StudentCalendar from "@/components/StudentCalendar";
import type { BookableSlot, CompanySettings } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * 교육생 '수강신청' — 가능한 모든 슬롯을 조회해 직접 신청.
 * 단, 센터가 수강신청을 대행하는 경우(center_managed_registration=true)
 * 신청 화면을 비활성화하고 안내만 표시.
 */
export default async function StudentRegisterPage() {
  const profile = await requireRole(["student", "admin"]);
  const supabase = createClient();

  // 본인 기업 설정 — center_managed_registration 확인
  let companySettings: CompanySettings | null = null;
  let holidayDates: Set<string> = new Set();
  if (profile.company_name) {
    const [{ data: cs }, { data: hs }] = await Promise.all([
      supabase
        .from("company_settings")
        .select("*")
        .eq("company_name", profile.company_name)
        .maybeSingle(),
      supabase
        .from("company_holidays")
        .select("holiday_date")
        .eq("company_name", profile.company_name),
    ]);
    companySettings = cs as CompanySettings | null;
    holidayDates = new Set((hs ?? []).map((h: any) => h.holiday_date));
  }

  const centerManaged = companySettings?.center_managed_registration ?? false;

  // 센터 대행 모드 — 캘린더 대신 안내만 표시
  if (centerManaged) {
    return (
      <>
        <AppHeader profile={profile} />
        <main className="mx-auto max-w-3xl px-4 py-6">
          <header className="mb-6">
            <h1 className="text-xl font-bold text-slate-800">수강신청</h1>
          </header>

          <section className="rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-8 text-center shadow-sm">
            <div className="mb-4 text-5xl">🏢</div>
            <h2 className="mb-2 text-lg font-bold text-slate-800">
              귀하의 수강신청은 귀사에서 대신합니다.
            </h2>
            <p className="text-sm leading-relaxed text-slate-600">
              {profile.company_name ? <><b>{profile.company_name}</b>의 수강신청은 회사 담당자가</> : "수강신청은 소속 기업의 담당자가"} 일괄 진행합니다.<br />
              개별 신청·변경 사항이 있으면 회사 교육 담당자에게 문의해 주세요.
            </p>
            <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
              <span>· 본인이 이미 신청된 수업은</span>
              <a href="/student/calendar" className="rounded-md border border-brand-300 bg-white px-2.5 py-1 font-medium text-brand-700 hover:bg-brand-50">
                내 수업 일정 →
              </a>
              <span>에서 확인할 수 있습니다.</span>
            </div>
          </section>
        </main>
      </>
    );
  }

  // 학생 직접 신청 모드 — 기존 booking 캘린더 로직 그대로
  const yearAhead = new Date();
  yearAhead.setFullYear(yearAhead.getFullYear() + 1);

  const { data: availabilities } = await supabase
    .from("time_slots")
    .select(
      "id, teacher_id, start_at, end_at, format, class_type, capacity, status, slot_duration_minutes"
    )
    .eq("status", "open")
    .lte("start_at", yearAhead.toISOString())
    .order("start_at", { ascending: true });

  const teacherIds = Array.from(
    new Set((availabilities ?? []).map((a: any) => a.teacher_id))
  );
  const teacherNames = new Map<string, string>();
  const teacherZoom = new Map<string, string | null>();
  const teacherTeams = new Map<string, string | null>();
  if (teacherIds.length > 0) {
    const [{ data: teachers }, { data: teacherMeta }] = await Promise.all([
      supabase.from("profiles").select("id, name").in("id", teacherIds),
      supabase.from("teachers").select("profile_id, zoom_url, teams_url").in("profile_id", teacherIds),
    ]);
    for (const t of teachers ?? []) teacherNames.set(t.id, t.name);
    for (const t of teacherMeta ?? []) {
      teacherZoom.set(t.profile_id, t.zoom_url);
      teacherTeams.set(t.profile_id, t.teams_url);
    }
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("slot_id, start_at, student_id")
    .eq("status", "confirmed");

  const bookedCount = new Map<string, number>();
  const myBooked = new Set<string>();
  let myBookingTotalCount = 0;
  for (const b of bookings ?? []) {
    const key = `${b.slot_id}|${new Date(b.start_at).toISOString()}`;
    bookedCount.set(key, (bookedCount.get(key) ?? 0) + 1);
    if (b.student_id === profile.id) {
      myBooked.add(key);
      myBookingTotalCount++;
    }
  }

  const totalSessions = companySettings?.total_sessions ?? null;
  const sessionsExhausted =
    totalSessions != null && myBookingTotalCount >= totalSessions;

  const now = Date.now();
  const allowedTeacherIds = companySettings?.allowed_teacher_ids ?? [];
  const allowedFormats = companySettings?.allowed_formats ?? [];
  const allowedClassTypes = companySettings?.allowed_class_types ?? [];

  const bookable: BookableSlot[] = [];
  for (const a of (availabilities ?? []) as any[]) {
    if (allowedTeacherIds.length > 0 && !allowedTeacherIds.includes(a.teacher_id)) continue;
    if (allowedFormats.length > 0 && !allowedFormats.includes(a.format)) continue;
    if (allowedClassTypes.length > 0 && !allowedClassTypes.includes(a.class_type)) continue;

    const dur = a.slot_duration_minutes ?? 60;
    const aStart = new Date(a.start_at).getTime();
    const aEnd = new Date(a.end_at).getTime();
    for (let t = aStart; t + dur * 60000 <= aEnd; t += dur * 60000) {
      const startDate = new Date(t);
      const startIso = startDate.toISOString();
      const endIso = new Date(t + dur * 60000).toISOString();

      const dateKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
      if (holidayDates.has(dateKey)) continue;

      const key = `${a.id}|${startIso}`;
      bookable.push({
        availability_id: a.id,
        teacher_id: a.teacher_id,
        teacher_name: teacherNames.get(a.teacher_id) ?? "이름 없음",
        start_at: startIso,
        end_at: endIso,
        format: a.format,
        class_type: a.class_type,
        capacity: a.capacity,
        status: a.status,
        booked_count: bookedCount.get(key) ?? 0,
        i_am_booked: myBooked.has(key),
        is_past: (t + dur * 60000) <= now,
        zoom_url: teacherZoom.get(a.teacher_id) ?? null,
        teams_url: teacherTeams.get(a.teacher_id) ?? null,
      });
    }
  }

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-4">
          <h1 className="text-xl font-bold text-slate-800">수강신청</h1>
          <p className="mt-1 text-sm text-slate-500">
            강사 이름을 클릭하면 수업을 신청하거나 취소할 수 있습니다.
            내가 신청한 수업은 <span className="font-semibold text-emerald-600">초록색</span>
            으로 표시되고 <span className="font-semibold">✓</span> 표시가 붙습니다.
          </p>
          {totalSessions != null && (
            <p className="mt-2 text-xs text-slate-500">
              내 차시 진행: <b>{myBookingTotalCount}</b> / {totalSessions}
              {sessionsExhausted && <span className="ml-2 text-red-600">· 모든 차시를 소진했습니다.</span>}
            </p>
          )}
          {holidayDates.size > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              · 기업 휴일로 지정된 {holidayDates.size}일은 달력에 표시되지 않습니다.
            </p>
          )}
        </header>
        <StudentCalendar slots={bookable} />
      </main>
    </>
  );
}
