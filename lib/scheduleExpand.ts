// 강사 시간표 반복 일정 확장.
// 업로드 행이 "기간(start~end) + 요일 + 시간 + 길이" 형태이면, 기간 안에서
// 매주 해당 요일·시각에 열리는 개별 수업 슬롯들로 펼친다.
// 요일이 여러 개면 콤마로 구분 (예: "tue,thu" / "월,수,금").
// 모든 시각은 한국시간(KST, UTC+9) 로 해석해 UTC ISO 로 저장한다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 요일 토큰 → 0(일)~6(토)
const DOW: Record<string, number> = {
  sun: 0, sunday: 0, "일": 0, "일요일": 0,
  mon: 1, monday: 1, "월": 1, "월요일": 1,
  tue: 2, tues: 2, tuesday: 2, "화": 2, "화요일": 2,
  wed: 3, weds: 3, wednesday: 3, "수": 3, "수요일": 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, "목": 4, "목요일": 4,
  fri: 5, friday: 5, "금": 5, "금요일": 5,
  sat: 6, saturday: 6, "토": 6, "토요일": 6,
};
const DOW_LABEL = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "tue,thu" / "월, 수" → [2,4] (0=일). 인식 못 하면 제외. */
export function parseDays(day: string): number[] {
  return String(day || "")
    .split(/[,/·|]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((s) => (s in DOW ? DOW[s] : DOW[s.replace(/요일$/, "")]))
    .filter((n): n is number => typeof n === "number");
}

export interface ExpandInput {
  startDate: string; // "YYYY-MM-DD" (KST 달력 기준)
  endDate: string; // "YYYY-MM-DD"
  days: string; // 요일 문자열 (콤마 구분)
  time: string; // "HH:mm"
  durationMin: number; // 수업 길이(분)
}

export interface ExpandedSlot {
  start_at: string; // UTC ISO
  end_at: string; // UTC ISO
  dayLabel: string; // 표시용 요일 (mon/tue…)
  time: string; // 표시용 "HH:mm" (KST)
  durationMin: number;
}

function parseYmd(s: string): [number, number, number] | null {
  const m = String(s).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return [+m[1], +m[2], +m[3]];
}

function parseHm(s: string): [number, number] | null {
  const m = String(s).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return [+m[1], +m[2]];
}

/** 기간·요일·시간을 개별 수업 슬롯 배열로 펼친다. 유효하지 않으면 []. */
export function expandRecurring(input: ExpandInput): ExpandedSlot[] {
  const days = parseDays(input.days);
  const start = parseYmd(input.startDate);
  const end = parseYmd(input.endDate);
  const hm = parseHm(input.time);
  const dur = Number(input.durationMin) || 60;
  if (!days.length || !start || !end || !hm) return [];

  const daySet = new Set(days);
  const out: ExpandedSlot[] = [];
  let cur = Date.UTC(start[0], start[1] - 1, start[2]);
  const endMs = Date.UTC(end[0], end[1] - 1, end[2]);
  let guard = 0;
  // 하루씩 순회 (UTC 달력 기준 → 시간대 밀림 없음). guard: 무한루프 방지 (~11년).
  while (cur <= endMs && guard++ < 4000) {
    const d = new Date(cur);
    const wd = d.getUTCDay();
    if (daySet.has(wd)) {
      // 해당 날짜의 KST HH:mm → UTC 순간
      const startUtcMs =
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hm[0], hm[1]) -
        KST_OFFSET_MS;
      out.push({
        start_at: new Date(startUtcMs).toISOString(),
        end_at: new Date(startUtcMs + dur * 60000).toISOString(),
        dayLabel: DOW_LABEL[wd],
        time: `${pad2(hm[0])}:${pad2(hm[1])}`,
        durationMin: dur,
      });
    }
    cur += 24 * 60 * 60 * 1000;
  }
  return out;
}
