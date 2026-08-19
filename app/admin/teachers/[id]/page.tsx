import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import { getCourseProgressMap, progressLabel } from "@/lib/courseProgress";

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
  const progressMap = await getCourseProgressMap(supabase, cIds);

  // 담당 학생 (예약 기반)
  const { data: slots } = await supabase
    .from("time_slots")
    .select("id, slot_duration_minutes")
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

  // ── 월별 정산 (Payroll) — 출석(present/late) 기준 시수 × 시급 ──
  const slotDur = new Map<string, number>();
  for (const s of slots ?? []) slotDur.set(s.id, (s as any).slot_duration_minutes ?? 60);
  const monthlyMap = new Map<string, { count: number; hours: number; first: string; last: string }>();
  if (slotIds.length > 0) {
    const { data: pays } = await supabase
      .from("bookings")
      .select("id, slot_id, start_at")
      .in("slot_id", slotIds)
      .eq("status", "confirmed");
    const payIds = (pays ?? []).map((b: any) => b.id);
    const attOk = new Set<string>();
    if (payIds.length > 0) {
      const { data: atts } = await supabase
        .from("attendance")
        .select("booking_id, status")
        .in("booking_id", payIds);
      for (const a of atts ?? []) if (a.status === "present" || a.status === "late") attOk.add(a.booking_id);
    }
    for (const b of pays ?? []) {
      if (!attOk.has(b.id)) continue;
      const d = new Date(b.start_at);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap.has(ym)) monthlyMap.set(ym, { count: 0, hours: 0, first: b.start_at, last: b.start_at });
      const m = monthlyMap.get(ym)!;
      m.count++;
      m.hours += (slotDur.get(b.slot_id) ?? 60) / 60;
      if (b.start_at < m.first) m.first = b.start_at;
      if (b.start_at > m.last) m.last = b.start_at;
    }
  }
  const { data: agRows } = await supabase
    .from("payroll_agreements")
    .select("period, agreed_at")
    .eq("teacher_id", params.id);
  const agreeMap = new Map<string, string>();
  for (const a of agRows ?? []) agreeMap.set(a.period, a.agreed_at);
  const rate = meta?.hourly_rate != null ? Number(meta.hourly_rate) : 0;
  const payroll = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([ym, v]) => {
      const fmt = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
      return {
        ym,
        period: `${fmt(v.first)} ~ ${fmt(v.last)}`,
        hours: Math.round(v.hours * 100) / 100,
        amount: rate > 0 ? Math.round(rate * v.hours) : null,
        agreedAt: agreeMap.get(ym) ?? null,
      };
    });

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
          <h2 className="mb-2 text-base font-semibold">💰 월별 정산 (Payroll)</h2>
          <p className="mb-2 text-xs text-slate-500">
            출석 체크(출석·지각) 기준 시수 × 시급. 강사는 매월 29일~다음달 7일에 [Agree]로 동의합니다.
          </p>
          {payroll.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">아직 진행된 수업이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">월</th>
                    <th className="px-3 py-2">기간</th>
                    <th className="px-3 py-2 text-right">시수(h)</th>
                    <th className="px-3 py-2 text-right">단가</th>
                    <th className="px-3 py-2 text-right">금액(KRW)</th>
                    <th className="px-3 py-2 text-center">강사 동의</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payroll.map((r) => (
                    <tr key={r.ym}>
                      <td className="px-3 py-2 font-medium text-slate-800">{r.ym}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500">{r.period}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{r.hours.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{rate > 0 ? rate.toLocaleString() : "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">{r.amount != null ? r.amount.toLocaleString() : "—"}</td>
                      <td className="px-3 py-2 text-center">
                        {r.agreedAt ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            ✓ {new Date(r.agreedAt).toLocaleDateString("ko-KR")}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">대기</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  <div className="mt-0.5 text-xs text-emerald-700">📖 {progressLabel(progressMap.get(c.id))}</div>
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
