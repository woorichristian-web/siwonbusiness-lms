// 업로드용 엑셀 템플릿 생성 (헤더 디자인 + 드롭다운/날짜 유효성).
// xlsx-js-style 은 데이터 유효성(드롭다운)을 쓸 수 없어 exceljs 로 생성한다.
// (업로드 파싱은 기존대로 xlsx 를 사용 — 생성 전용)
import ExcelJS from "exceljs";

export interface ColumnValidation {
  /** 드롭다운 목록 (셀 우측 ▼ 로 선택) */
  list?: string[];
  /** true(기본): 목록 외 값 차단 · false: 드롭다운은 뜨되 자유 입력도 허용(예: "mon,tue") */
  strict?: boolean;
  /** 날짜 컬럼 — yyyy-mm-dd 셀 서식 적용 */
  date?: boolean;
}

export interface StyledTemplateOptions {
  /** 첫 행(헤더)에 들어갈 컬럼명들 */
  headers: string[];
  /** 예시 데이터 행들 (headers 순서와 동일한 길이) */
  sample: (string | number)[][];
  /** 시트 이름 */
  sheetName: string;
  /** 저장 파일명 (.xlsx) */
  fileName: string;
  /** 컬럼별 유효성 — key 는 headers 의 컬럼명 */
  validations?: Record<string, ColumnValidation>;
}

const VALIDATION_ROWS = 300; // 드롭다운/서식을 미리 적용해 둘 행 수

/** 헤더 디자인 + 드롭다운이 적용된 업로드 템플릿 엑셀을 생성해 브라우저 다운로드시킨다. */
export async function downloadStyledTemplate({
  headers,
  sample,
  sheetName,
  fileName,
  validations = {},
}: StyledTemplateOptions) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);

  // 1) 헤더 행 — 브랜드 블루 배경 + 흰색 볼드 + 테두리
  ws.addRow(headers);
  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "맑은 고딕" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF172554" } },
      bottom: { style: "thin", color: { argb: "FF172554" } },
      left: { style: "thin", color: { argb: "FF172554" } },
      right: { style: "thin", color: { argb: "FF172554" } },
    };
  });

  // 2) 예시 행
  for (const row of sample) ws.addRow(row);

  // 3) 컬럼 폭 — 헤더/예시 중 가장 긴 텍스트 기준 (최소 10, 최대 40)
  headers.forEach((h, c) => {
    const bodyMax = sample.reduce(
      (m, row) => Math.max(m, String(row[c] ?? "").length),
      0,
    );
    ws.getColumn(c + 1).width = Math.min(Math.max(h.length, bodyMax, 8) + 2, 40);
  });

  // 4) 컬럼별 유효성 — 드롭다운 목록 / 날짜 서식
  headers.forEach((h, c) => {
    const v = validations[h];
    if (!v) return;
    const col = c + 1;
    if (v.date) ws.getColumn(col).numFmt = "yyyy-mm-dd";
    if (v.list && v.list.length > 0) {
      const strict = v.strict !== false;
      for (let r = 2; r <= VALIDATION_ROWS; r++) {
        ws.getCell(r, col).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`"${v.list.join(",")}"`],
          showErrorMessage: strict,
          ...(strict
            ? {
                errorStyle: "stop",
                errorTitle: "허용되지 않는 값",
                error: `다음 중에서 선택하세요: ${v.list.join(", ")}`,
              }
            : {}),
        };
      }
    }
  });

  // 5) 브라우저 다운로드
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
