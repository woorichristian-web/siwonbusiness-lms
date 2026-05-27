"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { adminBulkUploadTeachers, type TeacherImportRow } from "@/lib/actions/admin";

export default function AdminTeacherUploadForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<TeacherImportRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    errors: { row: number; reason: string }[];
  } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    setResult(null);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(ws, { raw: false, defval: "" });

      const parsed: TeacherImportRow[] = json.map((r) => ({
        username: String(r.username ?? "").trim(),
        password: String(r.password ?? "").trim() || undefined,
        name: String(r.name ?? "").trim(),
        birth_date: pickDate(r.birth_date),
        phone: String(r.phone ?? "").trim() || undefined,
        residence_area: String(r.residence_area ?? "").trim() || undefined,
        specialty: String(r.specialty ?? "").trim() || undefined,
        bio: String(r.bio ?? "").trim() || undefined,
        hourly_rate: String(r.hourly_rate ?? "").trim() || undefined,
        bank_name: String(r.bank_name ?? "").trim() || undefined,
        bank_account: String(r.bank_account ?? "").trim() || undefined,
        account_holder: String(r.account_holder ?? "").trim() || undefined,
        zoom_url: String(r.zoom_url ?? "").trim() || undefined,
        teams_url: String(r.teams_url ?? "").trim() || undefined,
      }));
      setRows(parsed);
    } catch (e: any) {
      setParseError("파일 파싱 실패: " + e.message);
      setRows([]);
    }
  }

  function onUpload() {
    if (rows.length === 0) return;
    startTransition(async () => {
      const r = await adminBulkUploadTeachers(rows);
      if (!r.ok) { alert(r.error); return; }
      setResult(r.result);
      router.refresh();
    });
  }

  function downloadTemplate() {
    const sample = [
      {
        username: "jane_kim",
        password: "Teacher1234!",
        name: "Jane Kim",
        birth_date: "1985-03-12",
        phone: "010-1111-2222",
        residence_area: "서울",
        specialty: "Business Conversation",
        bio: "Native English speaker with 8 years of corporate ESL experience.",
        hourly_rate: "35000",
        bank_name: "신한은행",
        bank_account: "110-123-456789",
        account_holder: "김제인",
        zoom_url: "https://zoom.us/j/9876543210?pwd=abcd1234",
        teams_url: "https://teams.microsoft.com/l/meetup-join/19%3ameeting...",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Teachers");
    XLSX.writeFile(wb, "teachers_template.xlsx");
  }

  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">파일 업로드</h3>
        <button type="button" onClick={downloadTemplate} className="btn-ghost text-xs">
          ⬇ 템플릿 다운로드
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="btn-ghost cursor-pointer">
          파일 선택
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
        </label>
        {fileName && (
          <span className="text-xs text-slate-500">
            📄 {fileName} · {rows.length} 행
          </span>
        )}
        <button
          type="button"
          onClick={onUpload}
          disabled={pending || rows.length === 0}
          className="btn ml-auto"
        >
          {pending ? "업로드 중..." : `업로드 (${rows.length})`}
        </button>
      </div>

      {parseError && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {parseError}
        </p>
      )}

      {rows.length > 0 && !result && (
        <p className="mt-3 text-xs text-slate-500">
          미리보기: {rows.slice(0, 3).map((r) => r.username).join(", ")}
          {rows.length > 3 && ` · 외 ${rows.length - 3}명`}
        </p>
      )}

      {result && (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="font-semibold text-slate-800">
            ✅ 처리 완료 — 신규 {result.created}명 · 업데이트 {result.updated}명
            {result.errors.length > 0 && (
              <span className="ml-2 text-red-600">· 오류 {result.errors.length}건</span>
            )}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 max-h-48 overflow-y-auto text-xs text-red-700">
              {result.errors.map((e, i) => (
                <li key={i}>· {e.row}행: {e.reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// Excel 날짜 셀 (Date 객체) 또는 문자열 → YYYY-MM-DD
function pickDate(v: any): string | undefined {
  if (!v) return undefined;
  if (v instanceof Date && !isNaN(v.getTime())) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  const s = String(v).trim();
  if (!s) return undefined;
  return s;
}
