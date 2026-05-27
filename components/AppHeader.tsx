// 로그인 후 공통 헤더. 세련된 디자인 — 아이콘 없이 깔끔한 텍스트.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import MessageNotifier from "@/components/MessageNotifier";

export default async function AppHeader({ profile }: { profile: Profile }) {
  // 안 읽은 메시지 수 (헤더 뱃지용)
  const supabase = createClient();
  const { count: unreadCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", profile.id)
    .is("read_at", null);

  const brandName =
    profile.role === "teacher" ? "Siwon Business — Teacher Portal" : "Siwon Business LMS";

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-3.5">
        {/* 좌측: 브랜드 + 메뉴 */}
        <div className="flex min-w-0 items-center gap-10">
          <Link
            href="/dashboard"
            className="shrink-0 text-lg font-bold tracking-tight text-slate-900 hover:text-brand-700"
          >
            <span className="text-brand-700">Siwon Business</span>
            <span className="ml-1.5 font-medium text-slate-500">
              {profile.role === "teacher" ? "Teacher Portal" : "LMS"}
            </span>
          </Link>

          <nav className="hidden gap-1 text-sm sm:flex">
            {profile.role === "student" && (
              <>
                <NavLink href="/student/calendar">수업일정</NavLink>
                <NavLink href="/student/status">수강현황</NavLink>
                <NavLink href="/student/progress">진행 리포트</NavLink>
                <NavLink href="/student/messages" badge={unreadCount ?? 0}>메시지</NavLink>
                <NavLink href="/student/profile">마이페이지</NavLink>
              </>
            )}
            {profile.role === "teacher" && (
              <>
                <NavLink href="/teacher/schedule">My Classes</NavLink>
                <NavLink href="/teacher/class-manage">Class Manage</NavLink>
                <NavLink href="/teacher/messages" badge={unreadCount ?? 0}>Messages</NavLink>
                <NavLink href="/teacher/profile">My Page</NavLink>
              </>
            )}
            {profile.role === "admin" && (
              <>
                <NavLink href="/admin">관리자 홈</NavLink>
                <NavLink href="/admin/users">회원 관리</NavLink>
                <NavLink href="/admin/companies">기업별 관리</NavLink>
                <NavLink href="/admin/upload">DB 관리</NavLink>
                <NavLink href="/admin/messages" badge={unreadCount ?? 0}>메시지</NavLink>
                <NavLink href="/admin/profile">마이페이지</NavLink>
              </>
            )}
          </nav>
        </div>

        {/* 우측: 사용자 + 로그아웃 */}
        <div className="flex items-center gap-3">
          <div className="hidden text-right text-sm sm:block">
            <div className="font-medium text-slate-700">{profile.name}</div>
            <div className="text-xs uppercase tracking-wider text-slate-400">
              {roleLabel(profile.role)}
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              {profile.role === "teacher" ? "Sign out" : "로그아웃"}
            </button>
          </form>
        </div>
      </div>

      {/* Realtime 알림 — 새 메시지 도착 시 토스트 표시 */}
      <MessageNotifier userId={profile.id} />
    </header>
  );
}

function NavLink({
  href, children, badge,
}: {
  href: string;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="relative rounded-md px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50 hover:text-brand-700"
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

function roleLabel(r: string) {
  if (r === "teacher") return "Teacher";
  return r === "admin" ? "Admin" : "Student";
}
