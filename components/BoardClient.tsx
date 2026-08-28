"use client";

// 자료실 클라이언트 — 게시글 목록/펼침, 글쓰기·수정·삭제, 첨부 업로드/다운로드.
// 파일은 브라우저에서 storage 'board' 버킷으로 직접 업로드 (관리자 RLS).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createBoardPost,
  updateBoardPost,
  deleteBoardPost,
  type BoardAttachment,
} from "@/lib/actions/board";

export interface BoardPost {
  id: string;
  title: string;
  body: string | null;
  author_id: string | null;
  author_name: string;
  attachments: BoardAttachment[];
  created_at: string;
  updated_at: string;
}

const MAX_FILE_MB = 50;

function fmtSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul",
  });
}

export default function BoardClient({ posts }: { posts: BoardPost[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<BoardPost | "new" | null>(null);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button type="button" className="btn" onClick={() => setEditing("new")}>
          + 글쓰기 / 자료 올리기
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
          아직 게시글이 없습니다. [글쓰기 / 자료 올리기]로 첫 자료를 올려보세요.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {posts.map((p) => (
            <PostRow
              key={p.id}
              post={p}
              open={openId === p.id}
              onToggle={() => setOpenId(openId === p.id ? null : p.id)}
              onEdit={() => setEditing(p)}
            />
          ))}
        </div>
      )}

      {editing && (
        <PostEditorModal
          post={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function PostRow({
  post, open, onToggle, onEdit,
}: {
  post: BoardPost;
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function download(a: BoardAttachment) {
    setErr(null);
    setDownloading(a.path);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from("board")
        .createSignedUrl(a.path, 60, { download: a.name });
      if (error || !data?.signedUrl) throw new Error(error?.message ?? "다운로드 링크 생성 실패");
      window.open(data.signedUrl, "_blank");
    } catch (e: any) {
      setErr("다운로드 실패: " + e.message);
    } finally {
      setDownloading(null);
    }
  }

  function remove() {
    if (!window.confirm(`[${post.title}] 게시글을 삭제할까요?\n첨부파일도 함께 삭제되며 복원할 수 없습니다.`)) return;
    startTransition(async () => {
      const r = await deleteBoardPost(post.id);
      if (!r.ok) { setErr(r.error ?? "삭제 실패"); return; }
      router.refresh();
    });
  }

  return (
    <div>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-800">
            {post.title}
            {post.attachments.length > 0 && (
              <span className="ml-1.5 text-xs font-normal text-slate-400">📎 {post.attachments.length}</span>
            )}
          </span>
          <span className="mt-0.5 block text-[11px] text-slate-400">
            {post.author_name} · {fmtDate(post.created_at)}
            {post.updated_at !== post.created_at && " (수정됨)"}
          </span>
        </span>
        <span className="shrink-0 text-xs text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
          {post.body && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{post.body}</p>
          )}

          {post.attachments.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-500">첨부파일</p>
              {post.attachments.map((a) => (
                <button
                  key={a.path}
                  type="button"
                  onClick={() => download(a)}
                  disabled={downloading === a.path}
                  className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-brand-400 hover:text-brand-700 disabled:opacity-60"
                >
                  <span className="shrink-0">📄</span>
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <span className="shrink-0 text-[11px] text-slate-400">{fmtSize(a.size)}</span>
                  <span className="shrink-0 text-xs font-semibold text-brand-600">
                    {downloading === a.path ? "생성 중..." : "다운로드 ↓"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {err && <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{err}</p>}

          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="btn-ghost !py-1 text-xs" onClick={onEdit}>수정</button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              {pending ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PostEditorModal({ post, onClose }: { post: BoardPost | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [attachments, setAttachments] = useState<BoardAttachment[]>(post?.attachments ?? []);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setErr(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const uploaded: BoardAttachment[] = [];
      for (const f of files) {
        if (f.size > MAX_FILE_MB * 1024 * 1024)
          throw new Error(`${f.name} — 파일당 최대 ${MAX_FILE_MB}MB까지 올릴 수 있습니다.`);
        // 경로는 ASCII로 안전하게, 원본 파일명은 메타로 보존
        const ext = (f.name.split(".").pop() ?? "bin").replace(/[^A-Za-z0-9]/g, "").slice(0, 10) || "bin";
        const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("board").upload(path, f);
        if (error) throw new Error(`${f.name} 업로드 실패: ${error.message}`);
        uploaded.push({ path, name: f.name, size: f.size });
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(path: string) {
    // 저장 시 서버에서 제거된 첨부를 스토리지에서도 정리한다
    setAttachments((prev) => prev.filter((a) => a.path !== path));
  }

  function save() {
    if (!title.trim()) { setErr("제목을 입력해 주세요."); return; }
    setErr(null);
    startTransition(async () => {
      const payload = { title, body: body.trim() || null, attachments };
      const r = post ? await updateBoardPost(post.id, payload) : await createBoardPost(payload);
      if (!r.ok) { setErr(r.error ?? "저장 실패"); return; }
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
      >
        <h3 className="mb-4 text-lg font-bold text-slate-800">
          {post ? "게시글 수정" : "글쓰기 / 자료 올리기"}
        </h3>

        <label className="label">제목 *</label>
        <input
          className="input"
          value={title}
          disabled={pending}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 2026 하반기 교재 PDF / 신규 강사 온보딩 자료"
        />

        <label className="label mt-3">내용 (선택)</label>
        <textarea
          className="input min-h-[120px]"
          value={body}
          disabled={pending}
          onChange={(e) => setBody(e.target.value)}
          placeholder="자료 설명이나 공유할 내용을 적어주세요."
        />

        <label className="label mt-3">첨부파일 (선택 · 파일당 최대 {MAX_FILE_MB}MB)</label>
        <div className="space-y-1.5">
          {attachments.map((a) => (
            <div key={a.path} className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate text-slate-700">{a.name}</span>
              <span className="shrink-0 text-[11px] text-slate-400">{fmtSize(a.size)}</span>
              <button
                type="button"
                onClick={() => removeAttachment(a.path)}
                className="shrink-0 text-xs text-red-500 hover:underline"
                disabled={pending || uploading}
              >
                제거
              </button>
            </div>
          ))}
          <label className={"btn-ghost inline-block cursor-pointer text-xs " + (uploading ? "opacity-60" : "")}>
            {uploading ? "업로드 중..." : "+ 파일 추가"}
            <input type="file" multiple className="hidden" disabled={uploading || pending} onChange={onFiles} />
          </label>
        </div>

        {err && <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={pending || uploading}>취소</button>
          <button className="btn" onClick={save} disabled={pending || uploading}>
            {pending ? "저장 중..." : post ? "수정 저장" : "게시"}
          </button>
        </div>
      </div>
    </div>
  );
}
