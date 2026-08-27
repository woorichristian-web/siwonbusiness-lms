// 스피킹 평가(Initial/Final Assessment) 공통 정의 — 영역 구조와 숙련도 매핑.
// 대영역 4개 · 소영역 10개, 각 1~10점. 서버 액션과 클라이언트 UI가 함께 쓴다.

export type AssessmentPhase = "initial" | "final";

export interface AssessmentItem {
  key: string;
  en: string;
  ko: string;
  /** 차트·엑셀 대시보드용 짧은 영문 라벨 */
  short: string;
}

export interface AssessmentGroup {
  key: string;
  label: string; // 대영역 (이미지 기준 영문 유지)
  items: AssessmentItem[];
}

export const ASSESSMENT_GROUPS: AssessmentGroup[] = [
  {
    key: "delivery",
    label: "Delivery",
    items: [
      { key: "pronunciation", en: "Clarity of Pronunciation", ko: "발음의 정확도", short: "Pronunciation" },
      { key: "pacing", en: "Pacing (Hesitation & Repetition)", ko: "말하기 속도", short: "Pacing" },
      { key: "intonation", en: "Intonation & Stress", ko: "억양과 강세", short: "Intonation & Stress" },
    ],
  },
  {
    key: "language",
    label: "Language Use",
    items: [
      { key: "grammar", en: "Accuracy of Grammar", ko: "문법의 정확도", short: "Grammar Accuracy" },
      { key: "structures", en: "Range of Structures", ko: "문장 구조의 다양성", short: "Range of Structures" },
      { key: "vocab_appropriateness", en: "Appropriateness of Vocabulary", ko: "어휘의 적합성", short: "Vocab Appropriateness" },
      { key: "vocab_variety", en: "Variety of Vocabulary", ko: "어휘의 다양성", short: "Vocab Variety" },
    ],
  },
  {
    key: "content",
    label: "Content",
    items: [
      { key: "message", en: "Clarity of the Message", ko: "정확한 메시지", short: "Message Clarity" },
      { key: "details", en: "Details & Support", ko: "세부 내용과 뒷받침", short: "Details & Support" },
    ],
  },
  {
    key: "interaction",
    label: "Inter.",
    items: [
      { key: "interaction", en: "Interaction", ko: "상대방에 대한 적절한 상호작용", short: "Interaction" },
    ],
  },
];

export const ASSESSMENT_ITEMS: AssessmentItem[] = ASSESSMENT_GROUPS.flatMap((g) => g.items);

export const ASSESSMENT_ITEM_KEYS: string[] = ASSESSMENT_ITEMS.map((i) => i.key);

/** 카테고리별 평균 (채점된 학생만 반영, 미채점 카테고리는 null) */
export function categoryAverages(
  scoreSets: Record<string, number>[],
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const k of ASSESSMENT_ITEM_KEYS) {
    const vals = scoreSets
      .map((s) => s[k])
      .filter((v): v is number => typeof v === "number" && v >= 1 && v <= 10);
    out[k] = vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return out;
}

/** 점수 1~10 → 숙련도 레벨 (열 헤더와 동일) */
export const PROFICIENCY_LEVELS = [
  "Novice Low",
  "Novice Mid",
  "Novice High",
  "Intermediate Low",
  "Intermediate Mid",
  "Intermediate High",
  "Advanced Low",
  "Advanced Mid",
  "Advanced High",
  "Superior",
] as const;

/** 점수(1~10)가 속한 상위 밴드 — 색상 구분용 */
export function scoreBand(n: number): "novice" | "intermediate" | "advanced" | "superior" {
  if (n <= 3) return "novice";
  if (n <= 6) return "intermediate";
  if (n <= 9) return "advanced";
  return "superior";
}

/**
 * 종합 숙련도 — 채점된 항목 평균을 올림해 레벨로 매핑.
 * (예: 10개 합계 22점 → 평균 2.2 → 3 → Novice High)
 */
export function proficiencyOf(scores: Record<string, number>): string | null {
  const vals = ASSESSMENT_ITEM_KEYS.map((k) => scores[k]).filter(
    (v): v is number => typeof v === "number" && v >= 1 && v <= 10,
  );
  if (vals.length === 0) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const idx = Math.min(10, Math.max(1, Math.ceil(avg)));
  return PROFICIENCY_LEVELS[idx - 1];
}

export function totalOf(scores: Record<string, number>): number {
  return ASSESSMENT_ITEM_KEYS.reduce((sum, k) => {
    const v = scores[k];
    return sum + (typeof v === "number" && v >= 1 && v <= 10 ? v : 0);
  }, 0);
}

export function scoredCount(scores: Record<string, number>): number {
  return ASSESSMENT_ITEM_KEYS.filter((k) => {
    const v = scores[k];
    return typeof v === "number" && v >= 1 && v <= 10;
  }).length;
}
