import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import StudentCalendar from "@/components/StudentCalendar";
import type { BookableSlot } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * 교육생 '수업일정' — 본인이 이미 신청한 수업만 카드로 표시.
 * 수강신청은 별도의 /student/register 페이지에서 수행.
 */
export default async function StudentCalendarPage() {
  const profile = await requireRole(["student", "admin"]);
  const supabase = createClient();

  // 내가 신청한 모든 confirmed 예약 (과거·미래 포함)
  const { data: myBookings } = await supabase
    .from("bookings")
    .select("slot_id, start_at, end_at")
    .eq("student_id", profile.id)
    .eq("status", "confirmed")
    .order("start_at", { ascending: true });

  // 슬롯 메타 (포맷·타입·정원 등) — bookings 의 slot_id 로 조회
  const slotIds = Array.from(new Set((myBookings ?? []).map((b: any) => b.slot_id)));
  const slotMeta = new Map<string, any>();
  if (slotIds.length > 0) {
    const { data: slots } = await supabase
      .from("time_slots")
      .select("id, teacher_id, format, class_type, capacity, status")
      .in("id", slotIds);
    for (const s of slots ?? []) slotMeta.set(s.id, s);
  }

  // 강사 정보 (이름, zoom_url, teams_url)
  const teacherIds = Array.from(
    new Set(Array.from(slotMeta.values()).map((s: any) => s.teacher_id))
  );
  const teacherNames = new Map<string, string>();
  const teacherZoom = new Map<string, string | null>();
  const teacherTeams = new Map<string, string | null>();
  if (teacherIds.length > 0) {
    const [{ data: tp }, { data: tm }] = await Promise.all([
      supabase.from("profiles").select("id, name").in("id", teacherIds),
      supabase.from("teachers").select("profile_id, zoom_url, teams_url").in("profile_id", teacherIds),
    ]);
    for (const t of tp ?? []) teacherNames.set(t.id, t.name);
    for (const t of tm ?? []) {
      teacherZoom.set(t.profile_id, t.zoom_url);
      teacherTeams.set(t.profile_id, t.teams_url);
    }
  }

  // 같은 슬롯에 같은 시작시간에 다른 학생이 들어있는지 counts
  const slotKeys = (myBookings ?? []).map((b: any) =>
    `${b.slot_id}|${new Date(b.start_at).toISOString()}`,
  );
  const bookedCountMap = new Map<string, number>();
  if (slotKeys.length > 0) {
    const { data: peerBookings } = await supabase
      .from("bookings")
      .select("slot_id, start_at")
      .in("slot_id", slotIds)
      .eq("status", "confirmed");
    for (const b of peerBookings ?? []) {
      const key = `${b.slot_id}|${new Date(b.start_at).toISOString()}`;
      bookedCountMap.set(key, (bookedCountMap.get(key) ?? 0) + 1);
    }
  }

  const now = Date.now();
  const mine: BookableSlot[] = (myBookings ?? [])
    .map((b: any) => {
      const meta = slotMeta.get(b.slot_id);
      if (!meta) return null;
      const startIso = new Date(b.start_at).toISOString();
      const endIso = new Date(b.end_at).toISOString();
      const key = `${b.slot_id}|${startIso}`;
      return {
        availability_id: b.slot_id,
        teacher_id: meta.teacher_id,
        teacher_name: teacherNames.get(meta.teacher_id) ?? "이름 없음",
        start_at: startIso,
        end_at: endIso,
        format: meta.format,
        class_type: meta.class_type,
        capacity: meta.capacity,
        status: meta.status,
        booked_count: bookedCountMap.get(key) ?? 1,
        i_am_booked: true,
        is_past: new Date(b.end_at).getTime() <= now,
        zoom_url: teacherZoom.get(meta.teacher_id) ?? null,
        teams_url: teacherTeams.get(meta.teacher_id) ?? null,
      } as BookableSlot;
    })
    .filter((x): x is BookableSlot => x !== null);

  const futureCount = mine.filter((s) => !s.is_past).length;
  const pastCount = mine.length - futureCount;

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-4">
          <h1 className="text-xl font-bold text-slate-800">내 수업 일정</h1>
          <p className="mt-1 text-sm text-slate-500">
            내가 신청한 수업의 일정과 정보를 확인합니다. 온라인 수업은 카드에서 <b>Zoom · Teams</b> 로 바로 입장할 수 있습니다.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            예정된 수업: <b className="text-emerald-600">{futureCount}</b>회 · 완료된 수업: <b>{pastCount}</b>회
          </p>
          {mine.length === 0 && (
            <p className="mt-2 text-xs text-amber-600">
              아직 신청한 수업이 없습니다. <a href="/student/register" className="ml-1 underline">수강신청 →</a>
            </p>
          )}
        </header>
        <StudentCalendar slots={mine} />
      </main>
    </>
  );
}
