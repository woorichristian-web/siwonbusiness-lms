// 만족도 설문 라운드 계산 — 4주차(시작+28일) / 기간 50% 경과 / 마지막 수업일(100%).
// 각 라운드는 해당 주의 시작(월요일)부터 노출되고, 그 주의 수업일로부터 5일 뒤에 마감된다.
// 강사 평가도 동일한 라운드를 쓴다.

export interface SurveyRound {
  round: 1 | 2 | 3;
  label: string;      // "4주차", "50%", "Final"
  open: Date;         // 노출 시작 — 라운드 기준일이 속한 주의 월요일 자정
  close: Date;        // 그 주 수업일 + 5일 자정 (미포함 상한)
}

/** 설문 문항 — 객관식 10문항(5점 척도) + 주관식 2문항은 별도 텍스트 필드 */
export const SURVEY_QUESTIONS: { key: string; cat: string; cat_en: string; text: string; text_en: string }[] = [
  { key: "q1", cat: "강사 관련", cat_en: "Trainer", text: "강사는 교육 주제에 대한 전문성과 충분한 지식을 갖추고 있었다.", text_en: "The trainer had strong expertise and sufficient knowledge of the subject." },
  { key: "q2", cat: "강사 관련", cat_en: "Trainer", text: "강사는 교육 내용을 이해하기 쉽고 명확하게 설명하였다.", text_en: "The trainer explained the content clearly and understandably." },
  { key: "q3", cat: "강사 관련", cat_en: "Trainer", text: "강사는 교육생의 질문과 의견에 성실하고 적극적으로 대응하였다.", text_en: "The trainer responded sincerely and actively to questions and opinions." },
  { key: "q4", cat: "강사 관련", cat_en: "Trainer", text: "강사는 교육생의 참여를 유도하고 원활한 학습 분위기를 조성하였다.", text_en: "The trainer encouraged participation and created a good learning atmosphere." },
  { key: "q5", cat: "과정 운영", cat_en: "Operation", text: "수업 진행 방식과 시간 배분은 효율적이고 적절하였다.", text_en: "The class format and time allocation were efficient and appropriate." },
  { key: "q6", cat: "과정 운영", cat_en: "Operation", text: "본 과정을 다른 동료에게 추천하겠다.", text_en: "I would recommend this course to my colleagues." },
  { key: "q7", cat: "과정 운영", cat_en: "Operation", text: "교육 운영 및 전반적인 과정 진행에 만족한다.", text_en: "I am satisfied with the overall course operation and progress." },
  { key: "q8", cat: "교육 내용", cat_en: "Content", text: "교육 내용은 이번 과정의 교육 목적에 적합하게 구성되었다.", text_en: "The content was well organized for the purpose of this course." },
  { key: "q9", cat: "교육 내용", cat_en: "Content", text: "교육 내용의 난이도와 수준은 나에게 적절하였다.", text_en: "The difficulty and level of the content were appropriate for me." },
  { key: "q10", cat: "교육 내용", cat_en: "Content", text: "이번 교육 내용은 실제 업무 또는 학습에 도움이 될 것으로 생각한다.", text_en: "The content will be useful for my actual work or learning." },
];

function atMidnight(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** 그 날짜가 속한 주의 월요일 자정 */
function weekMonday(d: Date): Date {
  const x = atMidnight(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

const WD_IDX: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

/**
 * 과정 시작/종료일로 3개 라운드 계산. 날짜 없으면 [].
 * weekdays(과정 수업 요일)를 주면 마감을 "그 주 마지막 수업일 + 5일"로 계산하고,
 * 없으면 라운드 기준일 + 5일로 계산한다.
 */
export function surveyRounds(
  startDate: string | null,
  endDate: string | null,
  weekdays?: string[] | null,
): SurveyRound[] {
  if (!startDate || !endDate) return [];
  const start = atMidnight(new Date(startDate + "T00:00:00"));
  const end = atMidnight(new Date(endDate + "T00:00:00"));
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return [];
  const dur = end.getTime() - start.getTime();
  const idxs = (weekdays ?? [])
    .map((d) => WD_IDX[d])
    .filter((n): n is number => n !== undefined);

  const mk = (round: 1 | 2 | 3, label: string, anchorMs: number): SurveyRound => {
    const anchor = atMidnight(new Date(anchorMs));   // 라운드 기준일 (4주차 / 50% / 마지막 수업일)
    const open = weekMonday(anchor);                 // 그 주 시작(월요일)부터 노출
    // 그 주의 마지막 수업일 — 수업 요일 정보가 없으면 기준일 자체
    const classDay = idxs.length > 0
      ? new Date(open.getTime() + Math.max(...idxs) * 86400000)
      : anchor;
    // 수업이 끝나고 5일 뒤 자정에 버튼·팝업이 사라진다
    let close = new Date(atMidnight(classDay).getTime() + 5 * 86400000);
    if (close <= open) close = new Date(open.getTime() + 7 * 86400000);
    return { round, label, open, close };
  };
  return [
    mk(1, "4주차", start.getTime() + 28 * 86400000),
    mk(2, "50%", start.getTime() + dur * 0.5),
    mk(3, "Final", end.getTime()),
  ];
}

/** 강사 평가 라운드 — 만족도 설문과 동일한 3개 시점(4주차 / 50% / 마지막 수업일)을 그대로 쓴다. */
export function teacherEvalRounds(
  startDate: string | null,
  endDate: string | null,
  weekdays?: string[] | null,
): SurveyRound[] {
  return surveyRounds(startDate, endDate, weekdays);
}

/** 지금 응답 가능한 라운드들 (주 시작 오픈 ~ 수업일+5일 마감) */
export function openRounds(
  startDate: string | null,
  endDate: string | null,
  weekdays?: string[] | null,
  now = new Date(),
): SurveyRound[] {
  return surveyRounds(startDate, endDate, weekdays).filter((r) => now >= r.open && now < r.close);
}

/** 마감되어 강사에게 전달된 라운드들 */
export function closedRounds(
  startDate: string | null,
  endDate: string | null,
  weekdays?: string[] | null,
  now = new Date(),
): SurveyRound[] {
  return surveyRounds(startDate, endDate, weekdays).filter((r) => now >= r.close);
}
