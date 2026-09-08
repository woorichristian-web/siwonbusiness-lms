import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import AppHeader from "@/components/AppHeader";
import StudentCalendar from "@/components/StudentCalendar";
import type { BookableSlot } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * 기업 담당자(마스터 계정) '수업일정' — 교육생 달력과 동일한 화면으로
 * 자기 회사 과정의 전체 수업 일정을 읽기 전용으로 본다.
 * (centerManaged 모드라 신청·취소 버튼 없이 안내만 표시)
 */
export default async function CompanyCalendarPage() {
  const profile = await requireRole(["company"]);
  const admin = createAdminClient();
  const company = profile.company_name;

  let slots: BookableSlot[] = [];
  if (company) {
    const { data: courses } = await admin
      .from("courses").select("id")
      .eq("company_name", company).eq("is_test", false);
    const courseIds = (courses ?? []).map((c: any) => c.id);

    if (courseIds.length > 0) {
      const { data: ts } = await admin
        .from("time_slots")
        .select("id, teacher_id, start_at, end_at, format, class_type, capacity, status")
        .in("course_id", courseIds)
        .order("start_at", { ascending: true });

      const teacherIds = Array.from(new Set((ts ?? []).map((s: any) => s.teacher_id)));
      const tName = new Map<string, string>();
      const tZoom = new Map<string, string | null>();
      const tTeams = new Map<string, string | null>();
      if (teacherIds.length > 0) {
        const [{ data: tp }, { data: tm }] = await Promise.all([
          admin.from("profiles").select("id, name").in("id", teacherIds),
          admin.from("teachers").select("profile_id, zoom_url, teams_url").in("profile_id", teacherIds),
        ]);
        for (const t of tp ?? []) tName.set(t.id, t.name);
        for (const t of tm ?? []) { tZoom.set(t.profile_id, t.zoom_url); tTeams.set(t.profile_id, t.teams_url); }
      }

      // 슬롯별 예약 수
      const slotIds = (ts ?? []).map((s: any) => s.id);
      const bookedCount = new Map<string, number>();
      for (let i = 0; i < slotIds.length; i += 100) {
        const { data: bks } = await admin
          .from("bookings").select("slot_id")
          .in("slot_id", slotIds.slice(i, i + 100)).eq("status", "confirmed");
        for (const b of bks ?? []) bookedCount.set(b.slot_id, (bookedCount.get(b.slot_id) ?? 0) + 1);
      }

      const now = Date.now();
      slots = (ts ?? []).map((s: any) => ({
        availability_id: s.id,
        teacher_id: s.teacher_id,
        teacher_name: tName.get(s.teacher_id) ?? "—",
        start_at: s.start_at,
        end_at: s.end_at,
        format: s.format,
        class_type: s.class_type,
        capacity: s.capacity,
        status: s.status,
        booked_count: bookedCount.get(s.id) ?? 0,
        i_am_booked: false,
        is_past: new Date(s.end_at).getTime() <= now,
        zoom_url: tZoom.get(s.teacher_id) ?? null,
        teams_url: tTeams.get(s.teacher_id) ?? null,
      }));
    }
  }

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-4">
          <h1 className="text-xl font-bold text-slate-800">수업 일정</h1>
          <p className="text-sm text-slate-500">
            {company ?? "회사"} 과정의 전체 수업 일정입니다. (읽기 전용 · 일정 변경은 시원스쿨 센터를 통해 요청해 주세요)
          </p>
        </header>
        <StudentCalendar slots={slots} centerManaged />
      </main>
    </>
  );
}
