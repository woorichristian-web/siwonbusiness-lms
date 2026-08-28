import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import BoardClient, { type BoardPost } from "@/components/BoardClient";

export const dynamic = "force-dynamic";

// 자료실 — 관리자 전용 게시판 (자료 업로드/다운로드 + 게시글)
export default async function AdminBoardPage() {
  const profile = await requireRole(["admin"]);
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("board_posts")
    .select("id, title, body, author_id, attachments, created_at, updated_at")
    .order("created_at", { ascending: false });

  const authorIds = Array.from(new Set((rows ?? []).map((r: any) => r.author_id).filter(Boolean)));
  const names = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: ps } = await supabase
      .from("profiles").select("id, name").in("id", authorIds);
    for (const p of ps ?? []) names.set(p.id, p.name);
  }

  const posts: BoardPost[] = (rows ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    author_id: r.author_id,
    author_name: r.author_id ? (names.get(r.author_id) ?? "(탈퇴한 관리자)") : "—",
    attachments: (r.attachments ?? []) as { path: string; name: string; size: number }[],
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">자료실</h1>
          <p className="text-sm text-slate-500">
            관리자 전용 공간입니다. 자료를 올리거나 게시글을 작성하고, 첨부파일을 다운로드할 수 있습니다.
          </p>
        </header>
        <BoardClient posts={posts} />
      </main>
    </>
  );
}
