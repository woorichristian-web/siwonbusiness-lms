import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import TeacherProfileTabs from "@/components/TeacherProfileTabs";
import type { Teacher } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TeacherProfilePage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const profile = await requireRole(["teacher", "admin"]);
  const supabase = createClient();
  const tab: "info" | "payroll" = searchParams.tab === "payroll" ? "payroll" : "info";

  // Teachers row
  const { data: teacher } = await supabase
    .from("teachers")
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle();

  // 통계용 데이터
  const { data: slots } = await supabase
    .from("time_slots")
    .select("id, slot_duration_minutes")
    .eq("teacher_id", profile.id);
  const slotIds = (slots ?? []).map((s: any) => s.id);
  const slotById = new Map<string, any>();
  for (const s of slots ?? []) slotById.set(s.id, s);

  // 누적 통계 + 월별 내역
  let totalCompleted = 0;
  let totalHours = 0;
  let thisMonthCompleted = 0;
  let thisMonthHours = 0;
  const monthlyMap = new Map<string, { count: number; hours: number }>();

  if (slotIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, slot_id, start_at, status")
      .in("slot_id", slotIds)
      .eq("status", "confirmed");

    const bookingIds = (bookings ?? []).map((b: any) => b.id);
    const attendanceMap = new Map<string, "present" | "absent" | "late" | "reschedule" | "other">();
    if (bookingIds.length > 0) {
      const { data: atts } = await supabase
        .from("attendance")
        .select("booking_id, status")
        .in("booking_id", bookingIds);
      for (const a of atts ?? []) {
        attendanceMap.set(a.booking_id, a.status as any);
      }
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const b of bookings ?? []) {
      const status = attendanceMap.get(b.id);
      if (status !== "present" && status !== "late") continue;

      const slot = slotById.get(b.slot_id);
      const hours = (slot?.slot_duration_minutes ?? 60) / 60;
      totalCompleted++;
      totalHours += hours;
      const startDate = new Date(b.start_at);
      if (startDate >= monthStart) {
        thisMonthCompleted++;
        thisMonthHours += hours;
      }

      // 월별 그룹핑 (YYYY-MM)
      const ym = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap.has(ym)) monthlyMap.set(ym, { count: 0, hours: 0 });
      const m = monthlyMap.get(ym)!;
      m.count++;
      m.hours += hours;
    }
  }

  // 월별 내역 — 최근순
  const monthly = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([yearMonth, v]) => ({
      yearMonth,
      classCount: v.count,
      hours: Math.round(v.hours * 100) / 100,
    }));

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">My Page</h1>
          <p className="text-sm text-slate-500">
            Manage your personal info and view your payroll details.
          </p>
        </header>

        <TeacherProfileTabs
          profile={profile}
          teacher={(teacher as Teacher) ?? null}
          tab={tab}
          stats={{
            totalCompleted,
            totalHours,
            thisMonthCompleted,
            thisMonthHours,
          }}
          monthly={monthly}
        />
      </main>
    </>
  );
}
