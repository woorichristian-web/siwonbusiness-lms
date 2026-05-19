import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import CompanyAdminClient from "@/components/CompanyAdminClient";
import CompanyCoursesList from "@/components/CompanyCoursesList";
import type { Profile, CompanySettings, CompanyHoliday } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: { name: string };
}) {
  const profile = await requireRole(["admin"]);
  const supabase = createClient();
  const selectedCompany = decodeURIComponent(params.name);

  // 전체 회원
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const allUsers = (allProfiles ?? []) as Profile[];
  const teachers = allUsers.filter((u) => u.role === "teacher");
  const companies = Array.from(
    new Set(
      allUsers
        .filter((u) => u.role === "student" && u.company_name)
        .map((u) => u.company_name!)
    )
  ).sort((a, b) => a.localeCompare(b, "ko"));

  // 선택 회사 데이터
  const members = allUsers.filter(
    (u) => u.role === "student" && u.company_name === selectedCompany
  );

  const [{ data: s }, { data: h }] = await Promise.all([
    supabase.from("company_settings").select("*").eq("company_name", selectedCompany).maybeSingle(),
    supabase.from("company_holidays").select("*").eq("company_name", selectedCompany)
      .order("holiday_date", { ascending: true }),
  ]);
  const settings = (s as CompanySettings) ?? null;
  const holidays = (h as CompanyHoliday[]) ?? [];

  // 회원별 예약 날짜
  const memberIds = members.map((m) => m.id);
  const bookingsByMember: Record<string, string[]> = {};
  if (memberIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("student_id, start_at")
      .in("student_id", memberIds)
      .eq("status", "confirmed")
      .order("start_at", { ascending: true });
    for (const b of bookings ?? []) {
      if (!bookingsByMember[b.student_id]) bookingsByMember[b.student_id] = [];
      bookingsByMember[b.student_id].push(b.start_at);
    }
  }

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4">
          <Link href="/admin/companies" className="text-sm text-brand-600 hover:underline">
            ← 기업 목록으로
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">🏢 {selectedCompany}</h1>
          <p className="text-sm text-slate-500">
            회원 {members.length}명 · 과정·강사·차시·휴일 설정 + 강좌별 리포트
          </p>
        </header>

        {/* 계약 강좌 리스트 — 최상단 */}
        <div className="mb-6">
          <CompanyCoursesList
            companyName={selectedCompany}
            members={members}
            teachers={teachers}
          />
        </div>

        <CompanyAdminClient
          companies={companies}
          selectedCompany={selectedCompany}
          teachers={teachers}
          members={members}
          settings={settings}
          holidays={holidays}
          bookingsByMember={bookingsByMember}
        />
      </main>
    </>
  );
}
