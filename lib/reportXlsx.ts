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
      rows.push([`${course.name}${course.code ? ` (${course.code})` : ""} · ${course.period}`]);
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
      rows.push([`${course.name}${course.code ? ` (${course.code})` : ""} · ${course.period} · 강사: ${course.teacherNames.join(", ") || "-"} · ${course.progress}`]);
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

// ---------------------------------------------------------------------
// 과정 데이터 리포트 (과정명 단위, 시트=기업별)
// ---------------------------------------------------------------------
import type { CourseNameReport } from "@/lib/actions/course";

export function buildCourseNameXlsx(d: CourseNameReport) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  for (const comp of d.companies) {
    const rows: any[][] = [
      [`과정 데이터 — ${d.courseName}`],
      ["작성자", d.author],
      ["다운로드 날짜", d.generatedAt],
      [],
      ["회사", comp.company],
      ["강좌코드", comp.code ?? "-"],
      ["수업 기간(전체)", comp.period],
      ["배정 강사", comp.assignedTeachers.join(", ") || "-"],
      ["진행 현황", comp.progress],
      [],
      ["교육생", "아이디", "강사", "수업 시간", "강사 만족도(/10)", "평가 점수(/10)", "만족도 코멘트"],
      ...comp.students.map((s) => [
        s.name, s.username, s.teachers, s.times,
        s.satisfaction ?? "-", s.score ?? "-", s.comments || "-",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 12 }, { wch: 15 }, { wch: 14 }, { wch: 18 },
      { wch: 14 }, { wch: 13 }, { wch: 60 },
    ];
    applyMetaStyles(ws, 7);
    for (const r of [4, 5, 6, 7, 8]) styleRow(ws, r, 2, SUB);
    styleRow(ws, 10, 7, HS);
    // 코멘트 칼럼 줄바꿈 표시
    for (let r = 11; r < rows.length; r++) {
      const a = XLSX.utils.encode_cell({ r, c: 6 });
      if (ws[a]) ws[a].s = { alignment: { wrapText: true, vertical: "top" }, font: { sz: 10, name: "맑은 고딕" } };
    }
    XLSX.utils.book_append_sheet(wb, ws, safeSheet(comp.company, used));

    // ── 점수 대시보드 시트 — Initial vs Final (그룹 평균 + 개인별 표·막대) ──
    if (comp.assessments.length > 0) {
      appendScoreDashboardSheet(wb, used, d, comp);
    }
  }

  const safe = d.courseName.replace(/[^\w가-힣]+/g, "_").slice(0, 30);
  XLSX.writeFile(wb, `과정데이터_${safe}_${yymmdd()}.xlsx`);
}

// ---------------------------------------------------------------------
// 점수 대시보드 (Score Dashboard) — Initial/Final 스피킹 평가
// 그룹 평균 표(+학생별 점수 열) 및 학생별 표, 막대(▇)로 점수를 시각화한다.
// ---------------------------------------------------------------------
import { ASSESSMENT_ITEMS, categoryAverages, proficiencyOf, totalOf } from "@/lib/assessment";

const INIT_HS = { ...HS, fill: { patternType: "solid", fgColor: { rgb: "2E9BD6" } } };
const FIN_HS = { ...HS, fill: { patternType: "solid", fgColor: { rgb: "ED7D31" } } };
const BAR_I_STYLE = { font: { sz: 10, name: "맑은 고딕", color: { rgb: "2E9BD6" } } };
const BAR_F_STYLE = { font: { sz: 10, name: "맑은 고딕", color: { rgb: "ED7D31" } } };

function bar(v: number | null | undefined): string {
  if (typeof v !== "number" || v <= 0) return "";
  return "▇".repeat(Math.max(1, Math.min(10, Math.round(v))));
}

function appendScoreDashboardSheet(
  wb: any,
  used: Set<string>,
  d: CourseNameReport,
  comp: CourseNameReport["companies"][number],
) {
  const list = comp.assessments;
  const iSets = list.map((a) => a.initial).filter(Boolean) as Record<string, number>[];
  const fSets = list.map((a) => a.final).filter(Boolean) as Record<string, number>[];
  const avgI = categoryAverages(iSets);
  const avgF = categoryAverages(fSets);
  const names = list.map((a) => a.name);

  const rows: any[][] = [
    [`점수 대시보드 (Score Dashboard) — ${d.courseName} · ${comp.company}`],
    ["작성자", d.author],
    ["다운로드 날짜", d.generatedAt],
    [],
  ];

  // 그룹 요약 표: Category | Initial/Final 평균 | 평균 막대 | 학생별 Initial | 학생별 Final
  const groupHeaderRow = rows.length;
  rows.push([
    "Category", "Initial (Group Avg)", "Final (Group Avg)", "Initial 그래프", "Final 그래프",
    ...names.map((n) => `${n} (I)`),
    ...names.map((n) => `${n} (F)`),
  ]);
  const groupDataStart = rows.length;
  for (const it of ASSESSMENT_ITEMS) {
    rows.push([
      it.short,
      avgI[it.key] != null ? Math.round(avgI[it.key]! * 10) / 10 : "-",
      avgF[it.key] != null ? Math.round(avgF[it.key]! * 10) / 10 : "-",
      bar(avgI[it.key]),
      bar(avgF[it.key]),
      ...list.map((a) => a.initial?.[it.key] ?? "-"),
      ...list.map((a) => a.final?.[it.key] ?? "-"),
    ]);
  }
  rows.push([]);

  // 학생별 블록
  const studentTitleRows: number[] = [];
  const studentHeaderRows: number[] = [];
  const studentDataRanges: Array<[number, number]> = [];
  for (const a of list) {
    const iT = a.initial ? totalOf(a.initial) : null;
    const fT = a.final ? totalOf(a.final) : null;
    const iP = a.initial ? proficiencyOf(a.initial) : null;
    const fP = a.final ? proficiencyOf(a.final) : null;
    studentTitleRows.push(rows.length);
    rows.push([
      `${a.name} — Initial ${iT != null ? `${iT}점 (${iP ?? "-"})` : "미평가"} / Final ${fT != null ? `${fT}점 (${fP ?? "-"})` : "미평가"}`,
    ]);
    studentHeaderRows.push(rows.length);
    rows.push(["Category", "Initial", "Final", "Initial 그래프", "Final 그래프"]);
    const dataStart = rows.length;
    for (const it of ASSESSMENT_ITEMS) {
      rows.push([
        it.short,
        a.initial?.[it.key] ?? "-",
        a.final?.[it.key] ?? "-",
        bar(a.initial?.[it.key]),
        bar(a.final?.[it.key]),
      ]);
    }
    studentDataRanges.push([dataStart, rows.length]);
    rows.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
    ...names.map(() => ({ wch: 10 })),
    ...names.map(() => ({ wch: 10 })),
  ];
  applyMetaStyles(ws, 5);

  // 그룹 표 헤더: 기본(남색) + 학생 Initial(파랑)/Final(주황)
  const totalCols = 5 + names.length * 2;
  styleRow(ws, groupHeaderRow, 5, HS);
  for (let c = 5; c < 5 + names.length; c++) {
    const aCell = XLSX.utils.encode_cell({ r: groupHeaderRow, c });
    if (ws[aCell]) ws[aCell].s = INIT_HS;
  }
  for (let c = 5 + names.length; c < totalCols; c++) {
    const aCell = XLSX.utils.encode_cell({ r: groupHeaderRow, c });
    if (ws[aCell]) ws[aCell].s = FIN_HS;
  }
  // 그룹 표의 막대 열 색
  for (let r = groupDataStart; r < groupDataStart + ASSESSMENT_ITEMS.length; r++) {
    const bi = XLSX.utils.encode_cell({ r, c: 3 });
    const bf = XLSX.utils.encode_cell({ r, c: 4 });
    if (ws[bi]) ws[bi].s = BAR_I_STYLE;
    if (ws[bf]) ws[bf].s = BAR_F_STYLE;
  }
  // 학생별 블록 스타일
  for (const r of studentTitleRows) styleRow(ws, r, 1, COURSE);
  for (const r of studentHeaderRows) styleRow(ws, r, 5, HS);
  for (const [s, e] of studentDataRanges) {
    for (let r = s; r < e; r++) {
      const bi = XLSX.utils.encode_cell({ r, c: 3 });
      const bf = XLSX.utils.encode_cell({ r, c: 4 });
      if (ws[bi]) ws[bi].s = BAR_I_STYLE;
      if (ws[bf]) ws[bf].s = BAR_F_STYLE;
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, safeSheet(`${comp.company} 점수`, used));
}

// ---------------------------------------------------------------------
// 만족도 설문 결과 리포트 (센터 전용 · 실명)
// 시트: [종합](라운드×강사 요약) + 라운드별 시트(강사 블록 아래 실명 응답)
// ---------------------------------------------------------------------
export interface SurveyXlsxData {
  courseName: string;
  courseCode: string | null;
  companyName: string | null;
  author: string;
  generatedAt: string;
  rounds: {
    round: number; label: string; open: string; close: string; avg: number | null;
    responses: {
      name: string; username: string;
      teacher_id: string | null; teacher_name: string;
      rating: number; comment: string | null; comment_en: string | null; created_at: string;
    }[];
  }[];
}

export function buildSurveyXlsx(d: SurveyXlsxData) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  const day = (iso: string) => iso.slice(0, 10);
  const title = `만족도 설문 결과 — ${d.courseName}${d.courseCode ? ` (${d.courseCode})` : ""}${d.companyName ? ` · ${d.companyName}` : ""}`;

  // 1) 종합 — 라운드 × 강사 요약
  {
    const rows: any[][] = [
      ...metaRows(title, d.author, d.generatedAt),
      ["라운드", "설문 기간", "강사", "응답 수", "평균 점수(10점)"],
    ];
    const subRows: number[] = [];
    for (const r of d.rounds) {
      const byTeacher = new Map<string, { name: string; ratings: number[] }>();
      for (const x of r.responses) {
        const key = x.teacher_id ?? "none";
        if (!byTeacher.has(key)) byTeacher.set(key, { name: x.teacher_name, ratings: [] });
        byTeacher.get(key)!.ratings.push(x.rating);
      }
      const period = `${day(r.open)} ~ ${day(r.close)}`;
      if (byTeacher.size === 0) {
        rows.push([`${r.round}차 (${r.label})`, period, "-", 0, "-"]);
      } else {
        for (const [, t] of byTeacher) {
          const avg = Math.round((t.ratings.reduce((s, v) => s + v, 0) / t.ratings.length) * 10) / 10;
          rows.push([`${r.round}차 (${r.label})`, period, t.name, t.ratings.length, avg]);
        }
        if (byTeacher.size > 1) {
          subRows.push(rows.length);
          rows.push([`${r.round}차 전체`, "", "", r.responses.length, r.avg ?? "-"]);
        }
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 13 }, { wch: 25 }, { wch: 14 }, { wch: 9 }, { wch: 14 }];
    applyMetaStyles(ws, 5);
    styleRow(ws, 4, 5, HS);
    for (const r of subRows) styleRow(ws, r, 5, SUB);
    XLSX.utils.book_append_sheet(wb, ws, safeSheet("종합", used));
  }

  // 2) 라운드별 시트 — 강사 블록 + 실명 응답
  for (const r of d.rounds) {
    const rows: any[][] = metaRows(
      `${r.round}차 설문 (${r.label}) — ${d.courseName} · ${day(r.open)} ~ ${day(r.close)}`,
      d.author, d.generatedAt,
    );
    const teacherRows: number[] = [];
    const headerRows: number[] = [];

    const byTeacher = new Map<string, { name: string; items: typeof r.responses }>();
    for (const x of r.responses) {
      const key = x.teacher_id ?? "none";
      if (!byTeacher.has(key)) byTeacher.set(key, { name: x.teacher_name, items: [] });
      byTeacher.get(key)!.items.push(x);
    }

    if (byTeacher.size === 0) {
      rows.push(["아직 응답이 없습니다."]);
    }
    for (const [, t] of byTeacher) {
      const avg = Math.round((t.items.reduce((s, v) => s + v.rating, 0) / t.items.length) * 10) / 10;
      teacherRows.push(rows.length);
      rows.push([`강사: ${t.name} · 응답 ${t.items.length}건 · 평균 ${avg}/10`]);
      headerRows.push(rows.length);
      rows.push(["교육생", "아이디", "점수(10점)", "코멘트", "코멘트(영문)", "제출일"]);
      for (const x of t.items) {
        rows.push([x.name, x.username, x.rating, x.comment ?? "", x.comment_en ?? "", day(x.created_at)]);
      }
      rows.push([]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 45 }, { wch: 45 }, { wch: 12 }];
    applyMetaStyles(ws, 6);
    for (const rr of teacherRows) styleRow(ws, rr, 6, COURSE);
    for (const rr of headerRows) styleRow(ws, rr, 6, HS);
    XLSX.utils.book_append_sheet(wb, ws, safeSheet(`${r.round}차 ${r.label}`, used));
  }

  const safe = (d.courseCode || d.courseName).replace(/[^\w가-힣]+/g, "_").slice(0, 30);
  XLSX.writeFile(wb, `설문결과_${safe}_${yymmdd()}.xlsx`);
}
