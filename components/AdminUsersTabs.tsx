"use client";

import { useMemo, useState } from "react";
import type { Profile } from "@/lib/types";
import AdminUsersTable from "@/components/AdminUsersTable";

type Tab = "students" | "teachers" | "admins";

export default function AdminUsersTabs({
  users,
  teachers,
}: {
  users: Profile[];
  teachers: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<Tab>("students");

  const students = useMemo(() => users.filter((u) => u.role === "student"), [users]);
  const teacherUsers = useMemo(() => users.filter((u) => u.role === "teacher"), [users]);
  const adminUsers = useMemo(() => users.filter((u) => u.role === "admin"), [users]);

  // Group students by company, sort 가나다 순
  const studentGroups = useMemo(() => {
    const map = new Map<string, Profile[]>();
    for (const s of students) {
      const key = s.company_name || "— 회사 미지정";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    // 가나다 순 정렬, "미지정"은 항상 맨 뒤
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a.startsWith("—")) return 1;
      if (b.startsWith("—")) return -1;
      return a.localeCompare(b, "ko");
    });
  }, [students]);

  // Teachers: 가나다 순 정렬
  const teachersSorted = useMemo(
    () => [...teacherUsers].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [teacherUsers]
  );

  // Admins: 가나다 순 정렬
  const adminsSorted = useMemo(
    () => [...adminUsers].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [adminUsers]
  );

  return (
    <div>
      {/* 탭 헤더 */}
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        <TabBtn
          active={tab === "students"}
          onClick={() => setTab("students")}
          count={students.length}
        >
          🎓 교육생
        </TabBtn>
        <TabBtn
          active={tab === "teachers"}
          onClick={() => setTab("teachers")}
          count={teacherUsers.length}
        >
          🧑‍🏫 강사
        </TabBtn>
        <TabBtn
          active={tab === "admins"}
          onClick={() => setTab("admins")}
          count={adminUsers.length}
        >
          👨‍💼 관리자
        </TabBtn>
      </div>

      {/* 교육생 탭 — 기업별 그룹 */}
      {tab === "students" && (
        <div className="space-y-6">
          {studentGroups.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
              등록된 교육생이 없습니다.
            </div>
          ) : (
            studentGroups.map(([company, list]) => (
              <section key={company} className="rounded-lg border border-slate-200 bg-white">
                <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
                  <h2 className="font-semibold text-slate-800">🏢 {company}</h2>
                  <span className="text-xs text-slate-500">{list.length}명</span>
                </header>
                <AdminUsersTable users={list} teachers={teachers} />
              </section>
            ))
          )}
        </div>
      )}

      {/* 강사 탭 */}
      {tab === "teachers" && (
        <section className="rounded-lg border border-slate-200 bg-white">
          {teachersSorted.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">등록된 강사가 없습니다.</div>
          ) : (
            <>
              <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
                <h2 className="font-semibold text-slate-800">전체 강사 목록</h2>
                <span className="text-xs text-slate-500">{teachersSorted.length}명</span>
              </header>
              <AdminUsersTable users={teachersSorted} teachers={teachers} />
            </>
          )}
        </section>
      )}

      {/* 관리자 탭 */}
      {tab === "admins" && (
        <section className="rounded-lg border border-slate-200 bg-white">
          {adminsSorted.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">등록된 관리자가 없습니다.</div>
          ) : (
            <>
              <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
                <h2 className="font-semibold text-slate-800">전체 관리자 목록</h2>
                <span className="text-xs text-slate-500">{adminsSorted.length}명</span>
              </header>
              <AdminUsersTable users={adminsSorted} teachers={teachers} />
            </>
          )}
        </section>
      )}
    </div>
  );
}

function TabBtn({
  active, onClick, count, children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition " +
        (active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-700")
      }
    >
      {children}
      <span className={
        "rounded-full px-2 py-0.5 text-xs " +
        (active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600")
      }>
        {count}
      </span>
    </button>
  );
}
