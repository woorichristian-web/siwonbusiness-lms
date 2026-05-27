import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import CompanyAdminClient from "@/components/CompanyAdminClient";
import CompanyCoursesList from "@/components/CompanyCoursesList";
import CompanyDetailTabs from "@/components/CompanyDetailTabs";
import CompanyPerformanceView from "@/components/CompanyPerformanceView";
import { getCompanyPerformance } from "@/lib/company-performance";
import type { Profile, CompanySettings, CompanyHoliday } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: { name: string };
  searchParams: { tab?: string; month?: string };
}) {
  const profile = await requireRole(["admin"]);
  const supabase = createClient();
  const selectedCompany = decodeURIComponent(params.name);
  const isPerformance = searchParams.tab === "performance";

  // ===== 공통 데이터 =====
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

  const members = allUsers.filter(
    (u) => u.role === "student" && u.company_name === selectedCompany
  );

  // ===== 과정관리 탭용 데이터 =====
  let settings: CompanySettings | null = null;
  let holidays: CompanyHoliday[] = [];
  const bookingsByMember: Record<string, string[]> = {};

  if (!isPerformance) {
    const [{ data: s }, { data: h }] = await Promise.all([
      supabase.from("company_settings").select("*").eq("company_name", selectedCompany).maybeSingle(),
      supabase.from("company_holidays").select("*").eq("company_name", selectedCompany)
        .order("holiday_date", { ascending: true }),
    ]);
    settings = (s as CompanySettings) ?? null;
    holidays = (h as CompanyHoliday[]) ?? [];

    const memberIds = members.map((m) => m.id);
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
  }

  // ===== 성과관리 탭용 데이터 =====
  let performanceData: Awaited<ReturnType<typeof getCompanyPerformance>> | null = null;
  if (isPerformance) {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;
    if (searchParams.month) {
      const [y, m] = searchParams.month.split("-").map(Number);
      if (Number.isInteger(y) && Number.isInteger(m) && m >= 1 && m <= 12) {
        year = y;
        month = m;
      }
    }
    performanceData = await getCompanyPerformance(selectedCompany, year, month);
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
            회원 {members.length}명 · 과정관리 + 성과관리
          </p>
        </header>

        <CompanyDetailTabs
          companyName={selectedCompany}
          current={isPerformance ? "performance" : "course"}
        />

        {!isPerformance && (
          <>
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
          </>
        )}

        {isPerformance && performanceData && (
          <CompanyPerformanceView
            companyName={selectedCompany}
            data={performanceData}
          />
        )}
      </main>
    </>
  );
}
