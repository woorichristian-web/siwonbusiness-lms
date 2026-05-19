import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const profile = await requireRole(["admin"]);
  const supabase = createClient();

  // 오늘 0시 ~ 내일 0시 (서버 로컬 시간 기준)
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  // 진행중 과정 = 시작일 ≤ 오늘 ≤ 종료일인 강좌 (학생 프로필 기반)
  const today = startOfToday.toISOString().slice(0, 10);

  const [
    { count: teacherCount },
    { count: todayBookingCount },
    { data: students },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "teacher"),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed")
      .gte("start_at", startOfToday.toISOString())
      .lt("start_at", startOfTomorrow.toISOString()),
    supabase
      .from("profiles")
      .select("company_name, course_name, course_start_date, course_end_date")
      .eq("role", "student"),
  ]);

  // 고유 고객사 수
  const companySet = new Set<string>();
  // 진행중 강좌 = (회사명 + 강좌명) 조합 중, 오늘이 시작~종료 범위에 있는 것
  const activeCourseSet = new Set<string>();

  for (const s of students ?? []) {
    if (s.company_name) companySet.add(s.company_name);
    if (s.company_name && s.course_name) {
      const start = s.course_start_date ?? null;
      const end = s.course_end_date ?? null;
      const isActive =
        (!start || start <= today) &&
        (!end || end >= today);
      if (isActive) activeCourseSet.add(`${s.company_name}||${s.course_name}`);
    }
  }

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-6 text-xl font-bold text-slate-800">관리자 홈</h1>

        {/* 핵심 대시보드 4개 */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="고객사"
            value={companySet.size}
            icon="🏢"
            href="/admin/companies"
            color="bg-blue-50 text-blue-700"
          />
          <Stat
            label="등록 강사"
            value={teacherCount ?? 0}
            icon="🧑‍🏫"
            href="/admin/users"
            color="bg-purple-50 text-purple-700"
          />
          <Stat
            label="진행중 과정"
            value={activeCourseSet.size}
            icon="📚"
            href="/admin/companies"
            color="bg-emerald-50 text-emerald-700"
          />
          <Stat
            label="오늘의 수업"
            value={todayBookingCount ?? 0}
            icon="📅"
            color="bg-amber-50 text-amber-700"
            subtitle={`예약 ${todayBookingCount ?? 0}건`}
          />
        </div>

        {/* 메뉴 카드 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card href="/admin/users" title="회원 관리"
            desc="전체 회원을 교육생·강사·관리자 탭으로 보기 / 역할 변경 / 삭제." />
          <Card href="/admin/users/add" title="회원 직접 추가"
            desc="교육생·강사·관리자 계정을 관리자가 직접 발급." />
          <Card href="/admin/companies" title="기업별 관리"
            desc="기업을 선택해 과정·강사·차시·휴일 설정 + 회원별 메모 + Excel 다운로드." />
          <Card href="/admin/upload" title="스케줄 일괄 업로드"
            desc="엑셀(.xlsx) 또는 CSV 로 강사별 시간 슬롯을 한꺼번에 등록." />
        </div>
      </main>
    </>
  );
}

function Stat({
  label, value, icon, href, color, subtitle,
}: {
  label: string;
  value: number;
  icon: string;
  href?: string;
  color: string;
  subtitle?: string;
}) {
  const body = (
    <div className={"rounded-lg border border-slate-200 bg-white p-4 transition " +
      (href ? "hover:border-brand-500 hover:shadow-md cursor-pointer" : "")}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{label}</span>
        <span className={"inline-flex h-6 w-6 items-center justify-center rounded-full text-sm " + color}>
          {icon}
        </span>
      </div>
      <div className="mt-2 text-3xl font-bold text-slate-800">{value}</div>
      {subtitle && <div className="mt-1 text-xs text-slate-400">{subtitle}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Card({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="card transition hover:border-brand-500 hover:shadow-md">
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{desc}</p>
    </Link>
  );
}
