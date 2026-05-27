"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { adminBulkUploadSlots, type SlotImportRow } from "@/lib/actions/admin";

export default function AdminUploadForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<SlotImportRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number; errors: { row: number; reason: string }[] } | null>(null);

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

      const parsed: SlotImportRow[] = json.map((r) => ({
        teacher_username: String(r.teacher_username ?? "").trim(),
        start_at: normalizeDate(r.start_at),
        end_at: normalizeDate(r.end_at),
        format: String(r.format ?? "").trim() as any,
        class_type: String(r.class_type ?? "").trim() as any,
        capacity: Number(r.capacity ?? 1),
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
      const r = await adminBulkUploadSlots(rows);
      if (!r.ok) { alert(r.error); return; }
      setResult(r.result);
      router.refresh();
    });
  }

  function downloadTemplate() {
    const sample = [
      {
        teacher_username: "jane",
        start_at: "2026-06-01 09:00",
        end_at: "2026-06-01 10:00",
        format: "online",
        class_type: "1on1",
        capacity: 1,
      },
      {
        teacher_username: "jane",
        start_at: "2026-06-01 11:00",
        end_at: "2026-06-01 12:00",
        format: "offline",
        class_type: "small_group",
        capacity: 4,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "강사시간표");
    XLSX.writeFile(wb, "teacher_schedule_template.xlsx");
  }

  return (
    <div>
      <section className="card mb-4">
        <header className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">파일 선택 (.xlsx, .xls, .csv)</h3>
          <button className="btn-ghost text-xs" onClick={downloadTemplate}>
            ⬇ 템플릿 다운로드
          </button>
        </header>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md
            file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm
            file:font-medium file:text-brand-700 hover:file:bg-brand-100" />
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
                  <th className="px-2 py-1">강사</th>
                  <th className="px-2 py-1">시작</th>
                  <th className="px-2 py-1">종료</th>
                  <th className="px-2 py-1">방식</th>
                  <th className="px-2 py-1">형태</th>
                  <th className="px-2 py-1">정원</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1">{r.teacher_username}</td>
                    <td className="px-2 py-1">{r.start_at}</td>
                    <td className="px-2 py-1">{r.end_at}</td>
                    <td className="px-2 py-1">{r.format}</td>
                    <td className="px-2 py-1">{r.class_type}</td>
                    <td className="px-2 py-1">{r.capacity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn mt-4" onClick={onUpload} disabled={pending}>
            {pending ? "업로드 중..." : `${rows.length}건 업로드`}
          </button>
        </section>
      )}

      {result && (
        <section className={"card mt-4 " + (result.errors.length > 0 ? "border-amber-300" : "border-green-300")}>
          <h3 className="mb-2 font-semibold">업로드 결과</h3>
          <p className="text-sm">✅ <b>{result.inserted}건</b> 등록됨</p>
          {result.errors.length > 0 && (
            <>
              <p className="mt-2 text-sm text-amber-700">⚠️ {result.errors.length}건 실패</p>
              <ul className="mt-1 max-h-40 overflow-y-auto text-xs text-slate-600">
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

// Excel datetime → ISO. cellDates 옵션을 켜면 Date 객체가 오기도 함.
function normalizeDate(v: any): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  // "2026-06-01 09:00" → "2026-06-01T09:00"
  const candidate = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(candidate);
  if (isNaN(d.getTime())) return s;  // 그대로 두면 서버에서 에러 처리
  return d.toISOString();
}
