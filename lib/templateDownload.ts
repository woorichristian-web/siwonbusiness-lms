// 업로드용 엑셀 템플릿 생성 (헤더 행 디자인 포함).
// SheetJS 무료판(xlsx)은 셀 스타일 쓰기를 지원하지 않으므로 드롭인 호환
// 라이브러리 xlsx-js-style 를 사용한다. (읽기/파싱 API 는 xlsx 와 동일)
import * as XLSX from "xlsx-js-style";

// 헤더 행 스타일 — 브랜드 블루(brand-700 #1E40AF) 배경 + 흰색 볼드,
// 가운데 정렬 + 얇은 테두리. 아래 데이터 행과 확실히 구분된다.
const HEADER_STYLE = {
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

export interface StyledTemplateOptions {
  /** 첫 행(헤더)에 들어갈 컬럼명들 */
  headers: string[];
  /** 예시 데이터 행들 (headers 순서와 동일한 길이) */
  sample: (string | number)[][];
  /** 시트 이름 */
  sheetName: string;
  /** 저장 파일명 (.xlsx) */
  fileName: string;
}

/** 헤더 디자인이 적용된 업로드 템플릿 엑셀을 생성해 브라우저 다운로드시킨다. */
export function downloadStyledTemplate({
  headers,
  sample,
  sheetName,
  fileName,
}: StyledTemplateOptions) {
  const aoa: (string | number)[][] = [headers, ...sample];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // 1) 헤더 행 셀마다 디자인 적용
  headers.forEach((_, c) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = HEADER_STYLE;
  });

  // 2) 컬럼 폭 — 헤더/예시 중 가장 긴 텍스트 기준 (최소 10, 최대 40)
  ws["!cols"] = headers.map((h, c) => {
    const bodyMax = sample.reduce(
      (m, row) => Math.max(m, String(row[c] ?? "").length),
      0,
    );
    return { wch: Math.min(Math.max(h.length, bodyMax) + 2, 40) };
  });

  // 3) 헤더 행 높이 살짝 키워 강조
  ws["!rows"] = [{ hpt: 22 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}
