// 센터용 리포트 엑셀 빌더 (강사 정산 / 교육생 명단).
// 시트 구성: [종합] + 기업별 시트(강좌 블록). 상단에 작성자·다운로드 날짜 기재.
// 파일명에는 다운로드 날짜가 YYMMDD 로 들어간다. (예: 강사정산_260819.xlsx)
import * as XLSX from "xlsx-js-style";
import type { TeacherPayrollReport } from "@/lib/actions/teacher-report";
import type { StudentCourseReport } from "@/lib/actions/student-report";

const HS = {
  font: { bold: true, sz: 11, color: { rgb: "FFFFFF" }, name: "맑은 고딕" },
  fill: { patternType: "solid", fgColor: { rgb: "1E40AF" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "172554" } },
    bottom: { style: "thin", color: { rgb: "172554" } },
    left: { style: "thin", color: { rgb: "172554" } },
    right: { style: "thin", color: { rgb: "172554" } },
  },
};
const TITLE = { font: { bold: true, sz: 15, name: "맑은 고딕", color: { rgb: "1E3A8A" } } };
const META = { font: { sz: 10, name: "맑은 고딕", color: { rgb: "64748B" } } };
const COURSE = {
  font: { bold: true, sz: 12, name: "맑은 고딕", color: { rgb: "1E3A8A" } },
  fill: { patternType: "solid", fgColor: { rgb: "DBEAFE" } },
};
const SUB = { font: { bold: true, sz: 10, name: "맑은 고딕", color: { rgb: "334155" } } };

function styleRow(ws: any, r: number, cols: number, style: any) {
  for (let c = 0; c < cols; c++) {
    const a = XLSX.utils.encode_cell({ r, c });
    if (ws[a]) ws[a].s = style;
  }
}
function yymmdd(): string {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${String(d.getUTCFullYear()).slice(2)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
}
function safeSheet(n: string, used: Set<string>) {
  let base = n.replace(/[[\]:*?/\\]/g, " ").slice(0, 28).trim() || "sheet";
  let name = base, i = 2;
  while (used.has(name)) name = `${base.slice(0, 25)} ${i++}`;
  used.add(name);
  return name;
}
function metaRows(title: string, author: string, generatedAt: string): any[][] {
  return [[title], ["작성자", author], ["다운로드 날짜", generatedAt], []];
}
function applyMetaStyles(ws: any, cols: number) {
  styleRow(ws, 0, 1, TITLE);
  styleRow(ws, 1, 2, META);
  styleRow(ws, 2, 2, META);
}

// ---------------------------------------------------------------------
// 강사 정산 리포트
// ---------------------------------------------------------------------
export function buildTeacherPayrollXlsx(d: TeacherPayrollReport) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  // 1) 종합 — 강사별 전체 합산
  {
    const rows: any[][] = [
      ...metaRows("강사 정산 리포트 — 종합", d.author, d.generatedAt),
      ["강사", "아이디", "시급(KRW)", "담당 강좌 수", "총 시수(h)", "총 정산액(KRW)"],
      ...d.totals.map((t) => [
        t.name, t.username,
        t.hourly_rate != null ? t.hourly_rate : "-",
        t.courseCount, t.totalHours,
        t.totalAmount != null ? t.totalAmount : "-",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 16 }];
    applyMetaStyles(ws, 6);
    styleRow(ws, 4, 6, HS);
    XLSX.utils.book_append_sheet(wb, ws, safeSheet("종합", used));
  }

  // 2) 기업별 시트 — 강좌 블록(강사 정보 + 월별 페이롤)
  for (const comp of d.companies) {
    const rows: any[][] = metaRows(`강사 정산 — ${comp.company}`, d.author, d.generatedAt);
    const headerRows: number[] = [];
    const courseRows: number[] = [];
    const subRows: number[] = [];

    for (const course of comp.courses) {
      courseRows.push(rows.length);
      rows.push([`📘 ${course.name}${course.code ? ` (${course.code})` : ""} · ${course.period}`]);
      for (const t of course.teachers) {
        subRows.push(rows.length);
        rows.push(["강사 정보"]);
        headerRows.push(rows.length);
        rows.push(["강사", "아이디", "연락처", "전문분야", "시급(KRW)", "은행", "계좌", "예금주"]);
        rows.push([t.name, t.username, t.phone ?? "-", t.specialty ?? "-",
          t.hourly_rate ?? "-", t.bank_name ?? "-", t.bank_account ?? "-", t.account_holder ?? "-"]);
        subRows.push(rows.length);
        rows.push(["이 강좌 페이롤"]);
        headerRows.push(rows.length);
        rows.push(["월", "기간", "시수(h)", "금액(KRW)"]);
        if (t.months.length === 0) rows.push(["-", "진행된 수업 없음", 0, "-"]);
        else for (const m of t.months) rows.push([m.ym, m.period, m.hours, m.amount ?? "-"]);
        rows.push(["합계", "", t.totalHours, t.totalAmount ?? "-"]);
        rows.push([]);
      }
      rows.push([]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 15 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 10 }];
    applyMetaStyles(ws, 8);
    for (const r of courseRows) styleRow(ws, r, 1, COURSE);
    for (const r of subRows) styleRow(ws, r, 1, SUB);
    for (const r of headerRows) styleRow(ws, r, 8, HS);
    XLSX.utils.book_append_sheet(wb, ws, safeSheet(comp.company, used));
  }

  XLSX.writeFile(wb, `강사정산_${yymmdd()}.xlsx`);
}

// ---------------------------------------------------------------------
// 교육생 명단 리포트
// ---------------------------------------------------------------------
export function buildStudentCourseXlsx(d: StudentCourseReport) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  // 1) 종합
  {
    const rows: any[][] = [
      ...metaRows("교육생 리포트 — 종합", d.author, d.generatedAt),
      ["교육생", "아이디", "회사", "수강 강좌 수", "예약 수업", "출석", "출석율(%)"],
      ...d.totals.map((t) => [
        t.name, t.username, t.company ?? "-", t.courseCount, t.booked, t.attended, t.rate ?? "-",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 10 }];
    applyMetaStyles(ws, 7);
    styleRow(ws, 4, 7, HS);
    XLSX.utils.book_append_sheet(wb, ws, safeSheet("종합", used));
  }

  // 2) 기업별 시트 — 강좌 블록(교육생 명단)
  for (const comp of d.companies) {
    const rows: any[][] = metaRows(`교육생 명단 — ${comp.company}`, d.author, d.generatedAt);
    const headerRows: number[] = [];
    const courseRows: number[] = [];

    for (const course of comp.courses) {
      courseRows.push(rows.length);
      rows.push([`📘 ${course.name}${course.code ? ` (${course.code})` : ""} · ${course.period} · 강사: ${course.teacherNames.join(", ") || "-"}`]);
      headerRows.push(rows.length);
      rows.push(["교육생", "아이디", "연락처", "예약 수업", "출석", "체크된 수업", "출석율(%)"]);
      for (const s of course.students)
        rows.push([s.name, s.username, s.phone ?? "-", s.booked, s.attended, s.marked, s.rate ?? "-"]);
      rows.push([]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 15 }, { wch: 10 }, { wch: 8 }, { wch: 11 }, { wch: 10 }];
    applyMetaStyles(ws, 7);
    for (const r of courseRows) styleRow(ws, r, 1, COURSE);
    for (const r of headerRows) styleRow(ws, r, 7, HS);
    XLSX.utils.book_append_sheet(wb, ws, safeSheet(comp.company, used));
  }

  XLSX.writeFile(wb, `교육생명단_${yymmdd()}.xlsx`);
}
