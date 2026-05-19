import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import TeacherProfileForm from "@/components/TeacherProfileForm";
import type { Teacher } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TeacherProfilePage() {
  const profile = await requireRole(["teacher", "admin"]);
  const supabase = createClient();

  // Teacher's own teachers row
  const { data: teacher } = await supabase
    .from("teachers")
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle();

  // Stats: how many classes this teacher has taught (attendance = present or late)
  const { data: slots } = await supabase
    .from("time_slots")
    .select("id, slot_duration_minutes")
    .eq("teacher_id", profile.id);
  const slotIds = (slots ?? []).map((s: any) => s.id);
  const slotById = new Map<string, any>();
  for (const s of slots ?? []) slotById.set(s.id, s);

  let totalCompleted = 0;
  let totalHours = 0;
  let thisMonthCompleted = 0;
  let thisMonthHours = 0;

  if (slotIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, slot_id, start_at, status")
      .in("slot_id", slotIds)
      .eq("status", "confirmed");

    const bookingIds = (bookings ?? []).map((b: any) => b.id);
    const attendanceMap = new Map<string, "present" | "absent" | "late">();
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
      if (status === "present" || status === "late") {
        const slot = slotById.get(b.slot_id);
        const hours = (slot?.slot_duration_minutes ?? 60) / 60;
        totalCompleted++;
        totalHours += hours;
        if (new Date(b.start_at) >= monthStart) {
          thisMonthCompleted++;
          thisMonthHours += hours;
        }
      }
    }
  }

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">My Page</h1>
          <p className="text-sm text-slate-500">
            View your account info and update your profile & payroll details.
          </p>
        </header>
        <TeacherProfileForm
          profile={profile}
          teacher={(teacher as Teacher) ?? null}
          stats={{
            totalCompleted,
            totalHours,
            thisMonthCompleted,
            thisMonthHours,
          }}
        />
      </main>
    </>
  );
}
