import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";

export const dynamic = "force-dynamic";

export default async function AdminTeacherDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await requireRole(["admin"]);
  const supabase = createClient();

  const { data: teacher } = await supabase
    .from("profiles")
    .select("id, name, username, phone, role")
    .eq("id", params.id)
    .maybeSingle();

  if (!teacher || teacher.role !== "teacher") {
    return (
      <>
        <AppHeader profile={profile} />
        <main className="mx-auto max-w-3xl px-4 py-10 text-center text-sm text-slate-500">
          강사를 찾을 수 없습니다.
          <div className="mt-3">
            <Link href="/admin/users" className="text-brand-700 underline">← 회원 관리</Link>
          </div>
        </main>
      </>
    );
  }

  const { data: meta } = await supabase
    .from("teachers")
    .select("specialty, bio, hourly_rate, number_of_classes, zoom_url, teams_url")
    .eq("profile_id", params.id)
    .maybeSingle();

  // 담당 과정 (활성)
  let courses: { id: string; name: string; company_name: string | null }[] = [];
  const { data: cts } = await supabase
    .from("course_teachers")
    .select("course_id")
    .eq("teacher_id", params.id)
    .is("assigned_until", null);
  const cIds = Array.from(new Set((cts ?? []).map((r: any) => r.course_id)));
  if (cIds.length > 0) {
    const { data: cs } = await supabase
      .from("courses")
      .select("id, name, company_name")
      .in("id", cIds);
    courses = (cs ?? []) as any;
  }

  // 담당 학생 (예약 기반)
  const { data: slots } = await supabase
    .from("time_slots")
    .select("id")
    .eq("teacher_id", params.id);
  const slotIds = (slots ?? []).map((s: any) => s.id);
  let students: { id: string; name: string; company_name: string | null }[] = [];
  if (slotIds.length > 0) {
    const { data: bks } = await supabase
      .from("bookings")
      .select("student_id")
      .in("slot_id", slotIds)
      .eq("status", "confirmed");
    const sIds = Array.from(new Set((bks ?? []).map((b: any) => b.student_id)));
    if (sIds.length > 0) {
      const { data: ss } = await supabase
        .from("profiles")
        .select("id, name, company_name")
        .in("id", sIds);
      students = (ss ?? []) as any;
    }
  }

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        <div>
          <Link href="/admin/messages" className="text-xs text-slate-400 hover:underline">← 메시지</Link>
          <h1 className="mt-1 text-xl font-bold text-slate-800">
            🧑‍🏫 {teacher.name} <span className="text-sm font-normal text-slate-400">강사 · @{teacher.username}</span>
          </h1>
        </div>

        <section className="card space-y-2 text-sm">
          <Row k="연락처" v={teacher.phone ?? "—"} />
          <Row k="전문 분야" v={meta?.specialty ?? "—"} />
          <Row k="시급" v={meta?.hourly_rate != null ? `${Number(meta.hourly_rate).toLocaleString()} 원` : "—"} />
          <Row k="진행 수업 수" v={meta?.number_of_classes != null ? `${meta.number_of_classes}회` : "—"} />
          <Row k="Zoom" v={meta?.zoom_url ?? "—"} />
          {meta?.bio && (
            <div className="pt-2">
              <div className="text-xs text-slate-500">소개</div>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{meta.bio}</p>
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="mb-2 text-base font-semibold">담당 과정 ({courses.length})</h2>
          {courses.length === 0 ? (
            <p className="text-sm text-slate-400">배정된 과정이 없습니다.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {courses.map((c) => (
                <li key={c.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  📘 {c.name}{c.company_name ? <span className="text-slate-400"> · {c.company_name}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="mb-2 text-base font-semibold">담당 교육생 ({students.length})</h2>
          {students.length === 0 ? (
            <p className="text-sm text-slate-400">예약된 교육생이 없습니다.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {students.map((s) => (
                <li key={s.id}>
                  <Link href={`/admin/progress/${s.id}`}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-brand-300 hover:text-brand-700">
                    {s.name}{s.company_name ? ` · ${s.company_name}` : ""}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex border-b border-slate-100 py-1 last:border-b-0">
      <span className="w-24 shrink-0 text-slate-500">{k}</span>
      <span className="flex-1 break-all text-slate-800">{v}</span>
    </div>
  );
}
