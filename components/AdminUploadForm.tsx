"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx-js-style";
import { adminBulkUploadSlots, type SlotImportRow } from "@/lib/actions/admin";
import { downloadStyledTemplate } from "@/lib/templateDownload";
import { expandRecurring } from "@/lib/scheduleExpand";

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

      const parsed: SlotImportRow[] = [];
      json.forEach((r) => {
        const teacher_username = String(r.teacher_username ?? "").trim();
        const format = normalizeFormat(r.format);
        const class_type = normalizeClassType(r.class_type);
        const capacity = Number(r.capacity ?? 1);
        const dayStr = String(r.day ?? "").trim();
        const timeStr = toClockTime(r.time);
        const durationMin =
          r["duration(min)"] != null && String(r["duration(min)"]).trim() !== ""
            ? Number(r["duration(min)"])
            : 60;

        // 기간 + 요일 + 시간이 있으면 → 반복 일정으로 펼친다
        if (dayStr && timeStr) {
          const slots = expandRecurring({
            startDate: toCalendarDate(r.start_at),
            endDate: toCalendarDate(r.end_at),
            days: dayStr,
            time: timeStr,
            durationMin,
          });
          slots.forEach((s) =>
            parsed.push({
              teacher_username,
              start_at: s.start_at,
              end_at: s.end_at,
              day: s.dayLabel,
              time: s.time,
              duration_min: s.durationMin,
              format,
              class_type,
              capacity,
            }),
          );
        } else {
          // 단일 수업 — start_at/end_at 을 그대로 슬롯 1개로
          parsed.push({
            teacher_username,
            start_at: normalizeDate(r.start_at),
            end_at: normalizeDate(r.end_at),
            format,
            class_type,
            capacity,
          });
        }
      });

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
    downloadStyledTemplate({
      headers: [
        "teacher_username", "start_at", "end_at", "day", "time",
        "duration(min)", "format", "class_type", "capacity",
      ],
      sample: [
        ["jayrho", "2026-08-11 09:00", "2026-08-11 10:00", "tue", "09:00", 60, "offline", "group", 6],
        ["jane_kim", "2026-08-13 19:00", "2026-08-13 20:00", "thu", "19:00", 60, "online", "1on1", 1],
      ],
      sheetName: "강사시간표",
      fileName: "teacher_schedule_template.xlsx",
    });
  }

  return (
    <div>
      <section className="card mb-4">
        <header className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">파일 선택 (.xlsx, .xls, .csv)</h3>
          <button className="btn-ghost text-xs" onClick={downloadTemplate}>
            템플릿 다운로드
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
                  <th className="px-2 py-1">요일</th>
                  <th className="px-2 py-1">시간</th>
                  <th className="px-2 py-1">시간(분)</th>
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
                    <td className="px-2 py-1">{r.day ?? ""}</td>
                    <td className="px-2 py-1">{r.time ?? ""}</td>
                    <td className="px-2 py-1">{r.duration_min ?? ""}</td>
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
          <p className="text-sm"><b>{result.inserted}건</b> 등록됨</p>
          {result.errors.length > 0 && (
            <>
              <p className="mt-2 text-sm text-amber-700">{result.errors.length}건 실패</p>
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

// format 값 정규화 — "Offline", "오프라인", "OFFLINE" 등 → "offline"/"online"
function normalizeFormat(v: any): any {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "";
  if (s.includes("off") || s.includes("오프")) return "offline";
  if (s.includes("on") || s.includes("온")) return "online";
  return s;
}

// class_type 값 정규화 → 1on1 / 1on1_coaching / group / group_coaching
function normalizeClassType(v: any): any {
  const raw = String(v ?? "").trim();
  const s = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!s) return "";
  const coaching = s.includes("coaching") || raw.includes("코칭");
  const isOne = s.startsWith("11") || s.includes("1on1") || s.includes("oneonone") || raw.includes("1:1") || raw.includes("일대일");
  const isGroup = s.includes("group") || s.includes("small") || raw.includes("그룹") || raw.includes("소그룹");
  if (isOne) return coaching ? "1on1_coaching" : "1on1";
  if (isGroup) return coaching ? "group_coaching" : "group";
  return raw;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

// 셀 값 → "YYYY-MM-DD" (달력 날짜, 시간대 밀림 없이). Date/엑셀serial/문자열 지원.
function toCalendarDate(v: any): string {
  if (v == null || v === "") return "";
  if (v instanceof Date && !isNaN(v.getTime()))
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  if (typeof v === "number") {
    // 엑셀 날짜 serial → UTC 날짜
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  const s = String(v).trim();
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`;
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); // M/D/YY(YY)
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return `${y}-${pad2(+m[1])}-${pad2(+m[2])}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime()))
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return s;
}

// 셀 값 → "HH:mm". Date/엑셀 시간 fraction/문자열("9:00", "9:00 AM", "9") 지원.
function toClockTime(v: any): string {
  if (v == null || v === "") return "";
  if (v instanceof Date && !isNaN(v.getTime()))
    return `${pad2(v.getHours())}:${pad2(v.getMinutes())}`;
  if (typeof v === "number") {
    const mins = Math.round((v % 1) * 24 * 60);
    return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
  }
  const s = String(v).trim();
  let m = s.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (m) {
    let h = +m[1];
    const ap = m[3]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return `${pad2(h)}:${pad2(+m[2])}`;
  }
  m = s.match(/^(\d{1,2})\s*(am|pm)$/i);
  if (m) {
    let h = +m[1];
    const ap = m[2].toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return `${pad2(h)}:00`;
  }
  m = s.match(/^(\d{1,2})$/);
  if (m) return `${pad2(+m[1])}:00`;
  return s;
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
