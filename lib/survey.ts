// 만족도 설문 라운드 계산 — 과정 기간의 10% / 50% 경과 시점 + 종료 당일.
// 각 라운드는 배포일부터 7일간 응답 가능.

export interface SurveyRound {
  round: 1 | 2 | 3;
  label: string;      // "10%", "50%", "Final"
  open: Date;         // 배포일 (KST 자정 기준)
  close: Date;        // open + 7일 (미포함 상한)
}

function atMidnight(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** 과정 시작/종료일로 3개 라운드 계산. 날짜 없으면 []. */
export function surveyRounds(startDate: string | null, endDate: string | null): SurveyRound[] {
  if (!startDate || !endDate) return [];
  const start = atMidnight(new Date(startDate + "T00:00:00"));
  const end = atMidnight(new Date(endDate + "T00:00:00"));
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return [];
  const dur = end.getTime() - start.getTime();
  const mk = (round: 1 | 2 | 3, label: string, openMs: number): SurveyRound => {
    const open = atMidnight(new Date(openMs));
    return { round, label, open, close: new Date(open.getTime() + 7 * 86400000) };
  };
  return [
    mk(1, "10%", start.getTime() + dur * 0.1),
    mk(2, "50%", start.getTime() + dur * 0.5),
    mk(3, "Final", end.getTime()),
  ];
}

/** 지금 응답 가능한(배포됨 + 7일 이내) 라운드들 */
export function openRounds(startDate: string | null, endDate: string | null, now = new Date()): SurveyRound[] {
  return surveyRounds(startDate, endDate).filter((r) => now >= r.open && now < r.close);
}

/** 마감되어 강사에게 전달된 라운드들 */
export function closedRounds(startDate: string | null, endDate: string | null, now = new Date()): SurveyRound[] {
  return surveyRounds(startDate, endDate).filter((r) => now >= r.close);
}
