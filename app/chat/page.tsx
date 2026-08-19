import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";

export const dynamic = "force-dynamic";

// 내가 참여한 대화방 목록. RLS(conv_select) 가 참여자 대화방만 반환한다.
export default async function ChatListPage() {
  const profile = await requireRole(["student", "teacher", "admin"]);
  const supabase = createClient();

  const { data: convs } = await supabase
    .from("conversations")
    .select("id, title, course_name, created_at")
    .order("created_at", { ascending: false });

  // 각 대화방 참여자 수
  const ids = (convs ?? []).map((c) => c.id);
  const countByConv = new Map<string, number>();
  if (ids.length > 0) {
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .in("conversation_id", ids);
    for (const p of parts ?? [])
      countByConv.set(p.conversation_id, (countByConv.get(p.conversation_id) ?? 0) + 1);
  }

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">수업 대화방</h1>
          <p className="text-sm text-slate-500">
            강좌별 대화방에서 강사·교육생이 함께 소통하고 파일을 공유합니다.
          </p>
        </header>

        {(convs ?? []).length === 0 ? (
          <div className="card text-center text-sm text-slate-500">
            아직 참여 중인 대화방이 없습니다.
          </div>
        ) : (
          <ul className="space-y-2">
            {(convs ?? []).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/chat/${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 transition hover:border-brand-300 hover:shadow-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-800">
                      {c.title}
                    </div>
                    {c.course_name && c.course_name !== c.title && (
                      <div className="truncate text-xs text-slate-500">
                        {c.course_name}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    참여 {countByConv.get(c.id) ?? 0}명 · 열기 ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
