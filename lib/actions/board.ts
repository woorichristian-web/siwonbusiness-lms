"use server";

// 자료실 (관리자 전용 게시판) 액션.
// 파일 업로드는 브라우저에서 storage로 직접 하고(관리자 RLS),
// 여기서는 게시글 메타(제목·본문·첨부 목록)만 저장한다.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface BoardAttachment {
  path: string;   // storage 'board' 버킷 내 경로
  name: string;   // 원본 파일명
  size: number;   // bytes
}

async function assertAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("관리자(센터) 권한이 필요합니다.");
  return { supabase, userId: user.id };
}

function cleanAttachments(list: BoardAttachment[] | undefined): BoardAttachment[] {
  return (list ?? [])
    .filter((a) => a && typeof a.path === "string" && a.path.length > 0)
    .map((a) => ({ path: a.path, name: String(a.name || "파일"), size: Number(a.size) || 0 }))
    .slice(0, 20);
}

export async function createBoardPost(input: {
  title: string;
  body?: string | null;
  attachments?: BoardAttachment[];
}) {
  let ctx;
  try { ctx = await assertAdmin(); }
  catch (e: any) { return { ok: false as const, error: e.message }; }
  const title = input.title?.trim();
  if (!title) return { ok: false as const, error: "제목을 입력해 주세요." };

  const { error } = await ctx.supabase.from("board_posts").insert({
    title,
    body: input.body?.trim() || null,
    author_id: ctx.userId,
    attachments: cleanAttachments(input.attachments),
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/board");
  return { ok: true as const };
}

export async function updateBoardPost(postId: string, input: {
  title: string;
  body?: string | null;
  attachments?: BoardAttachment[];
}) {
  let ctx;
  try { ctx = await assertAdmin(); }
  catch (e: any) { return { ok: false as const, error: e.message }; }
  const title = input.title?.trim();
  if (!title) return { ok: false as const, error: "제목을 입력해 주세요." };

  // 편집으로 제거된 첨부는 스토리지에서도 삭제
  const { data: prev } = await ctx.supabase
    .from("board_posts").select("attachments").eq("id", postId).maybeSingle();
  const nextList = cleanAttachments(input.attachments);
  const keep = new Set(nextList.map((a) => a.path));
  const removed = ((prev?.attachments ?? []) as BoardAttachment[])
    .map((a) => a.path).filter((p) => p && !keep.has(p));

  const { error } = await ctx.supabase
    .from("board_posts")
    .update({
      title,
      body: input.body?.trim() || null,
      attachments: nextList,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
  if (error) return { ok: false as const, error: error.message };

  if (removed.length > 0) {
    try { await createAdminClient().storage.from("board").remove(removed); } catch { /* 무시 */ }
  }
  revalidatePath("/admin/board");
  return { ok: true as const };
}

export async function deleteBoardPost(postId: string) {
  let ctx;
  try { ctx = await assertAdmin(); }
  catch (e: any) { return { ok: false as const, error: e.message }; }

  const { data: post } = await ctx.supabase
    .from("board_posts").select("attachments").eq("id", postId).maybeSingle();

  const { error } = await ctx.supabase.from("board_posts").delete().eq("id", postId);
  if (error) return { ok: false as const, error: error.message };

  const paths = ((post?.attachments ?? []) as BoardAttachment[])
    .map((a) => a.path).filter(Boolean);
  if (paths.length > 0) {
    try { await createAdminClient().storage.from("board").remove(paths); } catch { /* 무시 */ }
  }
  revalidatePath("/admin/board");
  return { ok: true as const };
}
