import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import StudentCalendar from "@/components/StudentCalendar";
import type { BookableSlot, CompanySettings, CompanyHoliday } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StudentCalendarPage() {
  const profile = await requireRole(["student", "admin"]);
  const supabase = createClient();

  const yearAhead = new Date();
  yearAhead.setFullYear(yearAhead.getFullYear() + 1);

  // 본인 기업 설정/휴일 조회 (교육생만 적용 — admin 본인 화면 시뮬레이션에서도 동일)
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

  // 강사 가능시간 (조회 후 강사명은 별도 조회로 합침)
  const { data: availabilities } = await supabase
    .from("time_slots")
    .select(
      "id, teacher_id, start_at, end_at, format, class_type, capacity, status, slot_duration_minutes"
    )
    .eq("status", "open")
    .lte("start_at", yearAhead.toISOString())
    .order("start_at", { ascending: true });

  // 강사 이름 매핑 — RLS 정책 0005 로 모든 로그인 사용자가 강사 프로필 조회 가능
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

  // 차시 한도 도달 여부
  const totalSessions = companySettings?.total_sessions ?? null;
  const sessionsExhausted =
    totalSessions != null && myBookingTotalCount >= totalSessions;

  // 가능시간 → 작은 슬롯
  const now = Date.now();
  const allowedTeacherIds = companySettings?.allowed_teacher_ids ?? [];
  const allowedFormats = companySettings?.allowed_formats ?? [];
  const allowedClassTypes = companySettings?.allowed_class_types ?? [];

  const bookable: BookableSlot[] = [];
  for (const a of (availabilities ?? []) as any[]) {
    // 강사 필터
    if (allowedTeacherIds.length > 0 && !allowedTeacherIds.includes(a.teacher_id)) continue;
    // 방식/형태 필터
    if (allowedFormats.length > 0 && !allowedFormats.includes(a.format)) continue;
    if (allowedClassTypes.length > 0 && !allowedClassTypes.includes(a.class_type)) continue;

    const dur = a.slot_duration_minutes ?? 60;
    const aStart = new Date(a.start_at).getTime();
    const aEnd = new Date(a.end_at).getTime();
    for (let t = aStart; t + dur * 60000 <= aEnd; t += dur * 60000) {
      const startDate = new Date(t);
      const startIso = startDate.toISOString();
      const endIso = new Date(t + dur * 60000).toISOString();

      // 휴일 필터 — 슬롯 시작 날짜가 휴일이면 제외
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
          <h1 className="text-xl font-bold text-slate-800">수업 달력</h1>
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
