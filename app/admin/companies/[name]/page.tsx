import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import CompanyAdminClient from "@/components/CompanyAdminClient";
import CompanyCoursesList from "@/components/CompanyCoursesList";
import CompanyDetailTabs from "@/components/CompanyDetailTabs";
import CompanyPerformanceView from "@/components/CompanyPerformanceView";
import { getCompanyPerformance, type CompanyPerformanceData } from "@/lib/company-performance";
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

  // 과정관리에서 생성된 이 회사의 과정 (자동 반영)
  const { data: companyCourses } = await supabase
    .from("courses")
    .select("*")
    .eq("company_name", selectedCompany)
    .order("name");
  const ccIds = (companyCourses ?? []).map((c: any) => c.id);
  const ccTeachers = new Map<string, string[]>();
  const ccStudents = new Map<string, number>();
  if (ccIds.length > 0) {
    const [{ data: cts2 }, { data: css2 }] = await Promise.all([
      supabase.from("course_teachers").select("course_id, teacher_id").in("course_id", ccIds).is("assigned_until", null),
      supabase.from("course_students").select("course_id").in("course_id", ccIds),
    ]);
    const tIds2 = Array.from(new Set((cts2 ?? []).map((r: any) => r.teacher_id)));
    const tName2 = new Map<string, string>();
    if (tIds2.length > 0) {
      const { data: tp2 } = await supabase.from("profiles").select("id, name").in("id", tIds2);
      for (const x of tp2 ?? []) tName2.set(x.id, x.name);
    }
    for (const r of cts2 ?? [])
      (ccTeachers.get(r.course_id) ?? ccTeachers.set(r.course_id, []).get(r.course_id)!).push(tName2.get(r.teacher_id) ?? "—");
    for (const r of css2 ?? [])
      ccStudents.set(r.course_id, (ccStudents.get(r.course_id) ?? 0) + 1);
  }
  const WD_KO: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };

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
            {(companyCourses ?? []).length > 0 && (
              <section className="card mb-6">
                <h2 className="mb-1 text-base font-semibold">📘 진행 과정</h2>
                <p className="mb-3 text-xs text-slate-500">
                  과정 관리에서 입력된 정보가 자동으로 반영됩니다.
                </p>
                <div className="space-y-2">
                  {(companyCourses ?? []).map((c: any) => (
                    <div key={c.id} className="rounded-md border border-slate-200 bg-slate-50/60 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-800">{c.name}</span>
                        {c.code && <span className="rounded bg-white px-2 py-0.5 font-mono text-xs text-slate-500 ring-1 ring-slate-200">{c.code}</span>}
                        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                          👥 {ccStudents.get(c.id) ?? 0}명
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        {c.language && <span>🗣 {c.language}</span>}
                        {c.textbook && <span>📖 {c.textbook}</span>}
                        {c.class_type && <span>{c.class_type === "1on1" ? "1:1" : "소그룹"}</span>}
                        {c.format && <span>{c.format === "online" ? "온라인" : "오프라인"}</span>}
                        <span>기간 {c.start_date ?? "?"} ~ {c.end_date ?? "?"}</span>
                        {(c.weekdays ?? []).length > 0 && (
                          <span>요일 {(c.weekdays as string[]).map((d) => WD_KO[d] ?? d).join("·")}</span>
                        )}
                        {c.class_time && <span>{c.class_time}{c.duration_min ? ` · ${c.duration_min}분` : ""}</span>}
                        {c.total_sessions != null && <span>총 {c.total_sessions}차시</span>}
                        <span>강사 {(ccTeachers.get(c.id) ?? []).join(", ") || "미배정"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
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
