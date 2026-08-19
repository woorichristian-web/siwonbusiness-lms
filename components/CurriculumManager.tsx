"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx-js-style";
import { downloadStyledTemplate } from "@/lib/templateDownload";
import { uploadCurriculum, type CurriculumRow } from "@/lib/actions/curriculum";

export interface CurriculumItem {
  session_no: number | null;
  session_date: string | null;
  topic: string | null;
  details: string | null;
  materials: string | null;
}

const HEADERS = ["차시", "날짜", "주제", "세부내용", "자료/과제"];

export default function CurriculumManager({
  courseId,
  courseName,
  rows,
  canEdit,
  updatedAt,
}: {
  courseId: string;
  courseName: string;
  rows: CurriculumItem[];
  canEdit: boolean;
  updatedAt?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function downloadTemplate() {
    downloadStyledTemplate({
      headers: HEADERS,
      sample: [[1, "2026-08-11", "Introductions", "Warm-up + 자기소개", "교재 p.1-3"]],
      sheetName: "Curriculum",
      fileName: "curriculum_template.xlsx",
    });
  }
  function downloadCurrent() {
    const aoa = [
      HEADERS,
      ...rows.map((r) => [r.session_no ?? "", r.session_date ?? "", r.topic ?? "", r.details ?? "", r.materials ?? ""]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Curriculum");
    XLSX.writeFile(wb, `curriculum_${courseName.replace(/[^\w가-힣]+/g, "_")}.xlsx`);
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setOk(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(ws, { raw: false, defval: "" });
      const parsed: CurriculumRow[] = json.map((r) => ({
        session_no: r["차시"] !== "" && !isNaN(Number(r["차시"])) ? Number(r["차시"]) : null,
        session_date: pickDate(r["날짜"]),
        topic: String(r["주제"] ?? "").trim() || null,
        details: String(r["세부내용"] ?? "").trim() || null,
        materials: String(r["자료/과제"] ?? "").trim() || null,
      }));
      startTransition(async () => {
        const res = await uploadCurriculum(courseId, parsed);
        if (!res.ok) { setErr(res.error); return; }
        setOk(`${res.count}개 항목 업로드 완료 · 센터·교육생에게 알림 발송됨`);
        router.refresh();
      });
    } catch (e: any) {
      setErr("파일 파싱 실패: " + e.message);
    }
    e.target.value = "";
  }

  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-800">커리큘럼 — {courseName}</h3>
          {updatedAt && (
            <p className="text-[11px] text-slate-400">최종 업데이트 {new Date(updatedAt).toLocaleString("ko-KR")}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {rows.length > 0 && (
            <button className="btn-ghost text-xs" onClick={downloadCurrent}>커리큘럼 다운로드</button>
          )}
          {canEdit && (
            <>
              <button className="btn-ghost text-xs" onClick={downloadTemplate}>템플릿</button>
              <label className="btn cursor-pointer text-xs">
                {pending ? "업로드 중..." : "엑셀 업로드"}
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={pending} onChange={onFile} />
              </label>
            </>
          )}
        </div>
      </div>

      {err && <p className="mb-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      {ok && <p className="mb-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">{ok}</p>}

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          등록된 커리큘럼이 없습니다.{canEdit ? " 템플릿을 받아 작성 후 업로드하세요." : ""}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 w-14">차시</th>
                <th className="px-3 py-2 w-28">날짜</th>
                <th className="px-3 py-2">주제</th>
                <th className="px-3 py-2">세부내용</th>
                <th className="px-3 py-2">자료/과제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="align-top">
                  <td className="px-3 py-2 font-medium text-slate-700">{r.session_no ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500">{r.session_date ?? "—"}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{r.topic ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-pre-wrap text-slate-600">{r.details ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-pre-wrap text-slate-500">{r.materials ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function pickDate(v: any): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  const s = String(v).trim();
  const m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
  return s || null;
}
