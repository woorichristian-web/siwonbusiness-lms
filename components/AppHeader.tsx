// 로그인 후 공통 헤더. 역할별 메뉴 + 메시지 뱃지 + Realtime 알림.
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

  return (
    <header className="bg-gradient-to-r from-brand-700 to-brand-600 text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-2xl font-extrabold tracking-tight"
          >
            <span aria-hidden>🎓</span>
            <span>
              {profile.role === "admin"
                ? "Siwon Business LMS"
                : profile.role === "teacher"
                  ? "Siwon Business — Teacher Portal"
                  : "Siwon Business 수강신청"}
            </span>
          </Link>
          <nav className="hidden gap-1 text-sm font-medium sm:flex">
            {profile.role === "student" && (
              <>
                <NavLink href="/student/calendar" icon="📅">수업일정</NavLink>
                <NavLink href="/student/status" icon="📊">수강현황</NavLink>
                <NavLink href="/student/progress" icon="📈">진행 리포트</NavLink>
                <NavLink href="/student/messages" icon="💬" badge={unreadCount ?? 0}>메시지</NavLink>
                <NavLink href="/student/profile" icon="👤">마이페이지</NavLink>
              </>
            )}
            {profile.role === "teacher" && (
              <>
                <NavLink href="/teacher/schedule" icon="🗓️">My Classes</NavLink>
                <NavLink href="/teacher/class-manage" icon="✅">Class Manage</NavLink>
                <NavLink href="/teacher/messages" icon="💬" badge={unreadCount ?? 0}>Messages</NavLink>
                <NavLink href="/teacher/profile" icon="👤">My Page</NavLink>
              </>
            )}
            {profile.role === "admin" && (
              <>
                <NavLink href="/admin" icon="🏠">관리자 홈</NavLink>
                <NavLink href="/admin/users" icon="👥">회원 관리</NavLink>
                <NavLink href="/admin/companies" icon="🏢">기업별 관리</NavLink>
                <NavLink href="/admin/upload" icon="📤">스케줄 업로드</NavLink>
                <NavLink href="/admin/messages" icon="💬" badge={unreadCount ?? 0}>메시지</NavLink>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm sm:inline">
            <b>{profile.name}</b>
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {roleLabel(profile.role)}
            </span>
          </span>
          <form action="/api/auth/signout" method="post">
            <button className="rounded-md bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25">
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
  href, icon, children, badge,
}: {
  href: string;
  icon: string;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="relative flex items-center gap-1.5 rounded-md px-3 py-1.5 transition hover:bg-white/15"
    >
      <span aria-hidden>{icon}</span>
      <span>{children}</span>
      {badge != null && badge > 0 && (
        <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

function roleLabel(r: string) {
  if (r === "teacher") return "Teacher";       // 강사 화면은 영어
  return r === "admin" ? "관리자" : "교육생";
}
