// 회원가입 폼에서 사용하는 옵션 목록.
// 필요 시 자유롭게 추가/수정하세요.

export const REGIONS = [
  "서울",
  "경기",
  "인천",
  "강원",
  "충북",
  "충남",
  "대전",
  "세종",
  "전북",
  "전남",
  "광주",
  "경북",
  "경남",
  "대구",
  "울산",
  "부산",
  "제주",
  "해외",
  "기타",
] as const;

export const INDUSTRIES = [
  "IT/소프트웨어",
  "금융/은행/보험",
  "제조업",
  "유통/물류",
  "건설/부동산",
  "의료/제약/바이오",
  "교육",
  "미디어/광고/마케팅",
  "공공기관/정부",
  "스타트업",
  "기타",
] as const;

export const JOB_ROLES = [
  "경영/기획",
  "영업",
  "마케팅",
  "개발/엔지니어링",
  "디자인",
  "인사/HR",
  "재무/회계",
  "고객지원",
  "교육/연구",
  "기타",
] as const;

export const LEARNING_PURPOSES = [
  "비즈니스 이메일/문서 작성",
  "회의 및 발표",
  "해외 출장/외국인 응대",
  "글로벌 협업 (이메일·메신저·통화)",
  "이직/승진 준비",
  "기초 회화 향상",
  "기타",
] as const;

export const CLASS_FORMATS = [
  { value: "online", label: "온라인" },
  { value: "offline", label: "오프라인" },
] as const;

export const CLASS_TYPES = [
  { value: "1on1", label: "1:1" },
  { value: "small_group", label: "소그룹 (Small group)" },
] as const;

export const TIME_PREFERENCES = [
  { value: "early_morning", label: "출근 전 / 이른 아침" },
  { value: "lunch", label: "점심시간" },
  { value: "evening", label: "퇴근 후 / 저녁" },
] as const;

// username → Supabase Auth 이메일 합성용 도메인
export const USERNAME_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_USERNAME_EMAIL_DOMAIN || "lms.siwon.local";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
}
