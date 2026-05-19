"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Profile, Role } from "@/lib/types";
import { adminChangeRole, adminDeleteUser } from "@/lib/actions/admin";
import MemberEditModal from "@/components/MemberEditModal";

export default function AdminUsersTable({
  users,
  teachers,
}: {
  users: Profile[];
  teachers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Profile | null>(null);

  function changeRole(id: string, role: Role) {
    if (!confirm(`이 사용자의 역할을 ${roleLabel(role)} 로 변경할까요?`)) return;
    startTransition(async () => {
      const r = await adminChangeRole(id, role);
      if (!r.ok) alert(r.error);
      else router.refresh();
    });
  }
  function removeUser(id: string) {
    if (!confirm("이 사용자 계정을 영구 삭제할까요? 되돌릴 수 없습니다.")) return;
    startTransition(async () => {
      const r = await adminDeleteUser(id);
      if (!r.ok) alert(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">이름</th>
            <th className="px-4 py-2">아이디</th>
            <th className="px-4 py-2">생년월일</th>
            <th className="px-4 py-2">연락처</th>
            <th className="px-4 py-2">산업/직무</th>
            <th className="px-4 py-2">학습 목적</th>
            <th className="px-4 py-2">선호</th>
            <th className="px-4 py-2">역할</th>
            <th className="px-4 py-2 text-right">관리</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-2 font-medium text-slate-800">{u.name}</td>
              <td className="px-4 py-2 text-slate-600">{u.username}</td>
              <td className="px-4 py-2 text-slate-600">{u.birth_date ?? "—"}</td>
              <td className="px-4 py-2 text-slate-600">{u.phone ?? "—"}</td>
              <td className="px-4 py-2 text-slate-600">
                {u.industry ?? "—"} {u.job_role ? "/ " + u.job_role : ""}
              </td>
              <td className="px-4 py-2 text-slate-600">{u.learning_purpose ?? "—"}</td>
              <td className="px-4 py-2 text-slate-600">
                <div className="space-y-0.5">
                  <div className="text-xs">방식: {(u.preferred_format ?? []).join(", ") || "—"}</div>
                  <div className="text-xs">시간: {(u.preferred_time ?? []).join(", ") || "—"}</div>
                </div>
              </td>
              <td className="px-4 py-2">
                <select className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                  value={u.role} disabled={pending}
                  onChange={(e) => changeRole(u.id, e.target.value as Role)}>
                  <option value="student">교육생</option>
                  <option value="teacher">강사</option>
                  <option value="admin">관리자</option>
                </select>
              </td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                {/* Anyone with bookings can have a progress report (admin can be a student too in some flows) */}
                <a className="text-xs text-emerald-600 hover:underline"
                   href={`/admin/progress/${u.id}`}>
                  리포트
                </a>
                <button className="ml-3 text-xs text-brand-600 hover:underline"
                  disabled={pending}
                  onClick={() => setEditing(u)}>
                  수정
                </button>
                <button className="ml-3 text-xs text-red-600 hover:underline" disabled={pending}
                  onClick={() => removeUser(u.id)}>삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <MemberEditModal
          member={editing}
          teachers={teachers}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function roleLabel(r: Role) {
  return r === "admin" ? "관리자" : r === "teacher" ? "강사" : "교육생";
}
