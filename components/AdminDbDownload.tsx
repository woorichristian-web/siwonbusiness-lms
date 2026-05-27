"use client";

import { useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";

/**
 * Comprehensive DB download:
 *   - All student profile fields
 *   - Course / teacher assignments
 *   - Booking dates ('/' separated)
 *   - Attendance rate %
 *   - Avg teacher feedback (Language + Attitude split)
 *   - Student → teacher feedback rating + comment
 */
export default function AdminDbDownload({
  companies,
}: {
  companies: string[];
}) {
  const [downloading, startTransition] = useTransition();
  const [scope, setScope] = useState<"all" | "company">("all");
  const [company, setCompany] = useState(companies[0] ?? "");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function downloadExcel() {
    setMsg(null);
    startTransition(async () => {
      try {
        const supabase = createClient();
        const date = new Date().toISOString().slice(0, 10);

        // 1) Students (전체 또는 회사별)
        let q = supabase
          .from("profiles")
          .select("*")
          .eq("role", "student");
        if (scope === "company" && company) q = q.eq("company_name", company);
        const { data: students, error: sErr } = await q;
        if (sErr) throw sErr;
        const studentList = students ?? [];

        if (studentList.length === 0) {
          setMsg({ type: "err", text: "다운로드할 교육생이 없습니다." });
          return;
        }

        const studentIds = studentList.map((s: any) => s.id);

        // 2) Teachers map (assigned_teacher_id → name)
        const teacherIdSet = new Set<string>();
        for (const s of studentList) {
          if (s.assigned_teacher_id) teacherIdSet.add(s.assigned_teacher_id);
        }
        const teacherById = new Map<string, { name: string; id: string }>();
        if (teacherIdSet.size > 0) {
          const { data: tList } = await supabase
            .from("profiles")
            .select("id, name")
            .in("id", Array.from(teacherIdSet));
          for (const t of tList ?? []) teacherById.set(t.id, t as any);
        }

        // 3) Bookings (per student)
        const { data: bookings } = await supabase
          .from("bookings")
          .select("id, student_id, slot_id, start_at, status")
          .in("student_id", studentIds)
          .eq("status", "confirmed")
          .order("start_at", { ascending: true });
        const bookingsByStudent = new Map<string, any[]>();
        for (const b of bookings ?? []) {
          if (!bookingsByStudent.has(b.student_id)) bookingsByStudent.set(b.student_id, []);
          bookingsByStudent.get(b.student_id)!.push(b);
        }

        // 4) Attendance (per booking)
        const bookingIds = (bookings ?? []).map((b: any) => b.id);
        const attendanceByBooking = new Map<string, string>();
        if (bookingIds.length > 0) {
          const { data: atts } = await supabase
            .from("attendance")
            .select("booking_id, status")
            .in("booking_id", bookingIds);
          for (const a of atts ?? []) attendanceByBooking.set(a.booking_id, a.status);
        }

        // 5) Teacher feedback (per booking) — for Language & Attitude averages
        const feedbackByStudent = new Map<string, any[]>();
        if (bookingIds.length > 0) {
          const { data: fbs } = await supabase
            .from("feedback")
            .select("*, booking:bookings!inner(student_id)")
            .in("booking_id", bookingIds);
          for (const f of fbs ?? []) {
            const sid = (f as any).booking?.student_id;
            if (!sid) continue;
            if (!feedbackByStudent.has(sid)) feedbackByStudent.set(sid, []);
            feedbackByStudent.get(sid)!.push(f);
          }
        }

        // 6) Student → teacher feedback (per student)
        const stfByStudent = new Map<string, any>();
        {
          const { data: stfs } = await supabase
            .from("student_teacher_feedback")
            .select("*")
            .in("student_id", studentIds);
          for (const f of stfs ?? []) {
            // If multiple teachers, keep latest
            const cur = stfByStudent.get(f.student_id);
            if (!cur || new Date(f.updated_at) > new Date(cur.updated_at)) {
              stfByStudent.set(f.student_id, f);
            }
          }
        }

        // 7) Build rows
        const today = new Date();
        const rows = studentList.map((s: any) => {
          const myBookings = bookingsByStudent.get(s.id) ?? [];
          const pastBookings = myBookings.filter((b: any) => new Date(b.start_at) <= today);
          const totalSessionsToDate = pastBookings.length;

          // 출석 count: attendance.status = present or late
          let presentCount = 0;
          for (const b of pastBookings) {
            const st = attendanceByBooking.get(b.id);
            if (st === "present" || st === "late") presentCount++;
          }
          const attendanceRate =
            totalSessionsToDate === 0
              ? null
              : Math.round((presentCount / totalSessionsToDate) * 100);

          // Teacher feedback averages (Language / Attitude)
          const fbs = feedbackByStudent.get(s.id) ?? [];
          const langKeys = [
            "grammar_accuracy", "grammar_complexity",
            "vocabulary_diversity", "vocabulary_relevancy",
            "comprehension",
            "content_clarity", "content_organization",
          ];
          const attKeys = ["participation", "tone_manner", "preparation"];
          const collect = (keys: string[]) => {
            const vals: number[] = [];
            for (const f of fbs) {
              for (const k of keys) {
                const v = (f as any)[k];
                if (typeof v === "number") vals.push(v);
              }
            }
            return vals.length === 0
              ? null
              : Math.round((vals.reduce((s, n) => s + n, 0) / vals.length) * 100) / 100;
          };
          const langAvg = collect(langKeys);
          const attAvg = collect(attKeys);

          // Student → teacher feedback
          const stf = stfByStudent.get(s.id);

          // Booking dates joined
          const dates = myBookings
            .map((b: any) => new Date(b.start_at))
            .sort((a: Date, b: Date) => a.getTime() - b.getTime())
            .map((d: Date) =>
              d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
            )
            .join(" / ");

          return {
            "기업명": s.company_name ?? "",
            "아이디": s.username,
            "이름": s.name,
            "생년월일": s.birth_date ?? "",
            "연락처": s.phone ?? "",
            "주거 지역": s.residence_area ?? "",
            "산업 분야": s.industry ?? "",
            "직무 분야": s.job_role ?? "",
            "학습 목적": s.learning_purpose ?? "",
            "선호 방식": (s.preferred_format ?? []).join(", "),
            "선호 시간": (s.preferred_time ?? []).join(", "),
            "강좌명": s.course_name ?? "",
            "수강 시작일": s.course_start_date ?? "",
            "수강 종료일": s.course_end_date ?? "",
            "총 차시": s.course_total_sessions ?? "",
            "배정 강사": s.assigned_teacher_id ? teacherById.get(s.assigned_teacher_id)?.name ?? "" : "",
            "신청 날짜 (이른순)": dates,
            "수강완료차수": totalSessionsToDate,
            "남은 차시": s.course_total_sessions != null
              ? Math.max(0, s.course_total_sessions - myBookings.length)
              : "무제한",
            "출석률(%)": attendanceRate != null ? attendanceRate : "",
            "Language 평균 점수": langAvg ?? "",
            "Attitude 평균 점수": attAvg ?? "",
            "교육생→강사 평가 점수": stf?.rating ?? "",
            "교육생→강사 코멘트": stf?.comment ?? "",
            "특이사항(관리자 메모)": s.admin_notes ?? "",
          };
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        // 컬럼 너비 자동 조절
        const headers = Object.keys(rows[0] ?? {});
        ws["!cols"] = headers.map((h) => ({
          wch: Math.min(28, Math.max(10, h.length + 2)),
        }));
        const wb = XLSX.utils.book_new();
        const sheetName = scope === "company" && company ? company.slice(0, 28) : "전체교육생";
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        const fileScope = scope === "company" && company ? company : "전체";
        XLSX.writeFile(wb, `Siwon_LMS_DB_${fileScope}_${date}.xlsx`);
        setMsg({ type: "ok", text: `${rows.length}명의 데이터를 다운로드했습니다.` });
      } catch (e: any) {
        setMsg({ type: "err", text: e.message ?? "다운로드 실패" });
      }
    });
  }

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="text-base font-semibold">📥 DB 통합 Excel 다운로드</h2>
        <p className="text-xs text-slate-500">
          업로드된 정보 + 강사의 출석 기록·피드백 + 교육생의 강사 평가까지 한 파일로 받습니다.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1 text-sm">
            <input
              type="radio"
              checked={scope === "all"}
              onChange={() => setScope("all")}
            />
            <span>전체 교육생</span>
          </label>
          <label className="inline-flex items-center gap-1 text-sm">
            <input
              type="radio"
              checked={scope === "company"}
              onChange={() => setScope("company")}
              disabled={companies.length === 0}
            />
            <span>기업별</span>
          </label>
          {scope === "company" && (
            <select
              className="input max-w-xs"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            >
              {companies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn ml-auto"
            onClick={downloadExcel}
            disabled={downloading}
          >
            {downloading ? "생성 중..." : "⬇ Excel 다운로드"}
          </button>
        </div>

        {msg && (
          <div className={
            "rounded-md border p-2 text-sm " +
            (msg.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700")
          }>{msg.text}</div>
        )}
      </section>

      <section className="card">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">📋 다운로드되는 컬럼</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-3">
          <span>· 기업명</span>
          <span>· 아이디</span>
          <span>· 이름</span>
          <span>· 생년월일</span>
          <span>· 연락처</span>
          <span>· 주거 지역</span>
          <span>· 산업 분야</span>
          <span>· 직무 분야</span>
          <span>· 학습 목적</span>
          <span>· 선호 방식</span>
          <span>· 선호 시간</span>
          <span>· 강좌명</span>
          <span>· 수강 시작/종료일</span>
          <span>· 총 차시</span>
          <span>· 배정 강사</span>
          <span>· 신청 날짜 (이른순)</span>
          <span>· 수강완료차수</span>
          <span>· 남은 차시</span>
          <span className="text-emerald-700">· 출석률(%) ⭐</span>
          <span className="text-emerald-700">· Language 평균 ⭐</span>
          <span className="text-emerald-700">· Attitude 평균 ⭐</span>
          <span className="text-amber-700">· 교육생→강사 평가 점수 ⭐</span>
          <span className="text-amber-700">· 교육생 코멘트 ⭐</span>
          <span>· 특이사항(관리자 메모)</span>
        </div>
      </section>
    </div>
  );
}
