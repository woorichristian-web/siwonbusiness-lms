"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { adminBulkUploadStudents, type StudentImportRow } from "@/lib/actions/admin";

export default function AdminStudentUploadForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<StudentImportRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    created: number;
    bookings_created: number;
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

      const parsed: StudentImportRow[] = json.map((r) => ({
        username: String(r.username ?? "").trim(),
        password: String(r.password ?? "").trim(),
        name: String(r.name ?? "").trim(),
        birth_date: pickDate(r.birth_date),
        phone: String(r.phone ?? "").trim() || undefined,
        residence_area: String(r.residence_area ?? "").trim() || undefined,
        company_name: String(r.company_name ?? "").trim() || undefined,
        industry: String(r.industry ?? "").trim() || undefined,
        job_role: String(r.job_role ?? "").trim() || undefined,
        learning_purpose: String(r.learning_purpose ?? "").trim() || undefined,
        assigned_teacher_username: String(r.assigned_teacher_username ?? "").trim() || undefined,
        course_name: String(r.course_name ?? "").trim() || undefined,
        course_start_date: pickDate(r.course_start_date),
        course_end_date: pickDate(r.course_end_date),
        course_total_sessions: String(r.course_total_sessions ?? "").trim() || undefined,
        schedule: String(r.schedule ?? "").trim() || undefined,
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
      const r = await adminBulkUploadStudents(rows);
      if (!r.ok) { alert(r.error); return; }
      setResult(r.result);
      router.refresh();
    });
  }

  function downloadTemplate() {
    const sample = [{
      username: "kim123",
      password: "kim1234567",
      name: "김길동",
      birth_date: "1990-05-15",
      phone: "010-1234-5678",
      residence_area: "서울",
      company_name: "시원스쿨",
      industry: "IT/소프트웨어",
      job_role: "개발/엔지니어링",
      learning_purpose: "비즈니스 이메일/문서 작성",
      assigned_teacher_username: "jane",
      course_name: "영어 회화 6개월 코스",
      course_start_date: "2026-06-01",
      course_end_date: "2026-11-30",
      course_total_sessions: 24,
      schedule: "2026-06-01 09:00 / 2026-06-08 09:00 / 2026-06-15 09:00",
    }];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "교육생");
    XLSX.writeFile(wb, "educatee_upload_template.xlsx");
  }

  return (
    <div>
      <section className="card mb-4">
        <header className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">파일 선택</h3>
          <button className="btn-ghost text-xs" onClick={downloadTemplate}>
            ⬇ 템플릿 다운로드
          </button>
        </header>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={onFile}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md
            file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm
            file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
        {fileName && <p className="mt-2 text-xs text-slate-500">선택된 파일: {fileName} · {rows.length} 행 파싱됨</p>}
        {parseError && <p className="mt-2 text-sm text-red-600">{parseError}</p>}
      </section>

      {rows.length > 0 && (
        <section className="card">
          <h3 className="mb-2 font-semibold">미리보기 (상위 10행)</h3>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-2 py-1">아이디</th>
                  <th className="px-2 py-1">이름</th>
                  <th className="px-2 py-1">회사</th>
                  <th className="px-2 py-1">배정강사</th>
                  <th className="px-2 py-1">강좌명</th>
                  <th className="px-2 py-1">차시</th>
                  <th className="px-2 py-1">기간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1">{r.username}</td>
                    <td className="px-2 py-1">{r.name}</td>
                    <td className="px-2 py-1">{r.company_name ?? "—"}</td>
                    <td className="px-2 py-1">{r.assigned_teacher_username ?? "—"}</td>
                    <td className="px-2 py-1 truncate max-w-[140px]">{r.course_name ?? "—"}</td>
                    <td className="px-2 py-1">{r.course_total_sessions ?? "—"}</td>
                    <td className="px-2 py-1">
                      {r.course_start_date || r.course_end_date
                        ? `${r.course_start_date ?? ""} ~ ${r.course_end_date ?? ""}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn mt-4" onClick={onUpload} disabled={pending}>
            {pending ? "업로드 중..." : `${rows.length}명 업로드`}
          </button>
        </section>
      )}

      {result && (
        <section className={"card mt-4 " + (result.errors.length > 0 ? "border-amber-300" : "border-green-300")}>
          <h3 className="mb-2 font-semibold">업로드 결과</h3>
          <p className="text-sm">✅ 교육생 <b>{result.created}명</b> 생성, 사전 예약 <b>{result.bookings_created}건</b></p>
          {result.errors.length > 0 && (
            <>
              <p className="mt-2 text-sm text-amber-700">⚠️ {result.errors.length}건 오류</p>
              <ul className="mt-1 max-h-48 overflow-y-auto text-xs text-slate-600">
                {result.errors.map((e, i) => (
                  <li key={i}>· Row {e.row}: {e.reason}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}

// Excel datetime/string → 'YYYY-MM-DD'
function pickDate(v: any): string | undefined {
  if (!v) return undefined;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  // YYYY-MM-DD 또는 YYYY/MM/DD 형식 처리
  const match = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }
  return s;
}
