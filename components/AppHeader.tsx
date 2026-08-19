// 로그인 후 공통 헤더. 세련된 다크 네이비 비즈니스 디자인.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import MessageNotifier from "@/components/MessageNotifier";
import MessagePopupOnLogin from "@/components/MessagePopupOnLogin";
import MobileMenuDrawer, { type MobileMenuItem } from "@/components/MobileMenuDrawer";
import NavLink from "@/components/NavLink";
import SurveyPopup, { type PendingSurvey } from "@/components/SurveyPopup";
import { openRounds } from "@/lib/survey";

export default async function AppHeader({ profile }: { profile: Profile }) {
  // 안 읽은 메시지 (개수 + 최근 5건은 팝업에 사용)
  const supabase = createClient();
  const { data: unreadMessages, count: unreadCount } = await supabase
    .from("messages")
    .select("id, body, created_at, sender_id", { count: "exact" })
    .eq("recipient_id", profile.id)
    .is("read_at", null)
    .order("created_at", { ascending: false });

  // 발신자 이름 매핑
  const senderInfo = new Map<string, { name: string; role: string }>();
  const senderIds = Array.from(new Set((unreadMessages ?? []).map((m: any) => m.sender_id)));
  if (senderIds.length > 0) {
    const { data: senders } = await supabase
      .from("profiles")
      .select("id, name, role")
      .in("id", senderIds);
    for (const s of senders ?? []) senderInfo.set(s.id, { name: s.name, role: s.role });
  }

  const popupMessages = (unreadMessages ?? []).map((m: any) => ({
    id: m.id,
    body: m.body,
    created_at: m.created_at,
    sender_name: senderInfo.get(m.sender_id)?.name ?? "—",
    sender_role: senderInfo.get(m.sender_id)?.role ?? "student",
  }));

  // 만족도 설문 자동 배포 — 학생: 응답 기간(7일) 중 미응답 설문을 팝업으로
  const pendingSurveys: PendingSurvey[] = [];
  if (profile.role === "student") {
    const { data: myCourses } = await supabase
      .from("course_students")
      .select("course_id")
      .eq("student_id", profile.id);
    const cIds = Array.from(new Set((myCourses ?? []).map((r: any) => r.course_id)));
    if (cIds.length > 0) {
      const [{ data: cs }, { data: resp }] = await Promise.all([
        supabase.from("courses").select("id, name, start_date, end_date").in("id", cIds),
        supabase.from("survey_responses").select("course_id, round").eq("student_id", profile.id).in("course_id", cIds),
      ]);
      const done = new Set((resp ?? []).map((r: any) => `${r.course_id}|${r.round}`));
      for (const c of cs ?? []) {
        for (const r of openRounds(c.start_date, c.end_date)) {
          if (!done.has(`${c.id}|${r.round}`)) {
            pendingSurveys.push({
              courseId: c.id, courseName: c.name,
              round: r.round, label: r.label, closeDate: r.close.toISOString(),
            });
          }
        }
      }
    }
  }

  const inboxHref =
    profile.role === "student"
      ? "/student/messages"
      : profile.role === "teacher"
        ? "/teacher/messages"
        : "/admin/messages";

  // 역할별 네비게이션 항목 — 데스크탑/모바일 공통 데이터
  const unread = unreadCount ?? 0;
  const navItems: MobileMenuItem[] =
    profile.role === "student"
      ? [
          { href: "/student/calendar", label: "수업일정" },
          { href: "/student/register", label: "수강신청" },
          { href: "/student/status", label: "수강현황" },
          { href: "/student/progress", label: "진행 리포트" },
          { href: "/student/messages", label: "메시지", badge: unread },
          { href: "/chat", label: "수업 대화방" },
          { href: "/student/profile", label: "마이페이지" },
        ]
      : profile.role === "teacher"
        ? [
            { href: "/teacher/schedule", label: "My Classes" },
            { href: "/teacher/class-manage", label: "Management" },
            { href: "/teacher/feedback", label: "Teaching Feedback" },
            { href: "/teacher/messages", label: "Messages", badge: unread },
            { href: "/chat", label: "Class Chat" },
            { href: "/teacher/profile", label: "My Page" },
          ]
        : [
            { href: "/admin", label: "관리자 홈" },
            { href: "/admin/courses", label: "과정 관리" },
            { href: "/admin/companies", label: "기업별 관리" },
            { href: "/admin/teachers", label: "강사 관리" },
            { href: "/admin/students", label: "교육생 관리" },
            { href: "/admin/messages", label: "메시지", badge: unread },
            { href: "/chat", label: "대화방" },
            { href: "/admin/upload", label: "DB 관리" },
            { href: "/admin/users", label: "회원 관리" },
            { href: "/admin/profile", label: "마이페이지" },
          ];

  const brandSubtitle = profile.role === "teacher" ? "Teacher Portal" : "LMS";
  const signOutLabel = profile.role === "teacher" ? "Sign out" : "로그아웃";

  return (
    <header className="relative bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-blue-100 shadow-lg">
      {/* 상단 얇은 골드 액센트 */}
      <div className="h-0.5 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400" />

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-6 sm:px-6 sm:py-3.5">
        {/* 좌측: 햄버거(모바일) + 브랜드 + 데스크탑 네비 */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-10">
          <MobileMenuDrawer
            items={navItems}
            userName={profile.name}
            userRole={roleLabel(profile.role)}
            brandSubtitle={brandSubtitle}
            signOutLabel={signOutLabel}
          />

          <Link
            href="/dashboard"
            className="min-w-0 shrink truncate text-base font-bold tracking-tight transition hover:opacity-90 sm:text-lg"
          >
            <span className="text-white">Siwon Business</span>
            {/* 부제는 데스크탑에서만 표시 — 모바일에선 햄버거 안에 들어감 */}
            <span className="ml-2 hidden font-medium tracking-wide text-amber-300 sm:inline">
              {brandSubtitle}
            </span>
          </Link>

          <nav className="hidden gap-1 text-sm sm:flex">
            {navItems.map((item) => (
              <NavLink key={item.href} href={item.href} badge={item.badge}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* 우측: 사용자 + 로그아웃 — 데스크탑 전용 (모바일은 햄버거 안에 포함) */}
        <div className="hidden items-center gap-3 sm:flex">
          <div className="text-right text-sm">
            <div className="font-medium text-white">{profile.name}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-300">
              {roleLabel(profile.role)}
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button
              className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-blue-50 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
            >
              {signOutLabel}
            </button>
          </form>
        </div>
      </div>

      {/* 하단 얇은 underline (메뉴 분리감) */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-300/20 to-transparent" />

      {/* Realtime 알림 — 새 메시지 도착 시 토스트 표시 */}
      <MessageNotifier userId={profile.id} />

      {/* 만족도 설문 자동 배포 팝업 (학생) */}
      {pendingSurveys.length > 0 && <SurveyPopup surveys={pendingSurveys} />}

      {/* 접속 시 안 읽은 메시지 팝업 (세션당 1회) */}
      {popupMessages.length > 0 && (
        <MessagePopupOnLogin
          unreadMessages={popupMessages}
          inboxHref={inboxHref}
          isTeacher={profile.role === "teacher"}
        />
      )}
    </header>
  );
}

function roleLabel(r: string) {
  if (r === "teacher") return "Teacher";
  return r === "admin" ? "Admin" : "Student";
}
