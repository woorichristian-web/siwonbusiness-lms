// 공통 DB 타입.

export type Role = "student" | "teacher" | "admin";
export type ClassFormat = "online" | "offline";
export type ClassType = "1on1" | "1on1_coaching" | "group" | "group_coaching" | "small_group";

/** 수업 형태 라벨 (small_group 은 구버전 값 — Group 수업으로 표시) */
export const CLASS_TYPE_KO: Record<string, string> = {
  "1on1": "1:1 수업",
  "1on1_coaching": "1:1 Coaching",
  group: "Group 수업",
  group_coaching: "Group Coaching",
  small_group: "Group 수업",
};
export const CLASS_TYPE_EN: Record<string, string> = {
  "1on1": "1:1 Class",
  "1on1_coaching": "1:1 Coaching",
  group: "Group Class",
  group_coaching: "Group Coaching",
  small_group: "Group Class",
};
export const classTypeKo = (v?: string | null) => (v ? CLASS_TYPE_KO[v] ?? v : "—");
export const classTypeEn = (v?: string | null) => (v ? CLASS_TYPE_EN[v] ?? v : "—");
export type SlotStatus = "open" | "closed";
export type BookingStatus = "confirmed" | "cancelled";

export interface Profile {
  id: string;
  role: Role;
  username: string;
  name: string;
  birth_date: string | null;
  residence_area: string | null;
  company_name: string | null;
  industry: string | null;
  job_role: string | null;
  learning_purpose: string | null;
  preferred_format: string[];
  preferred_time: string[];
  phone: string | null;
  admin_notes: string | null;
  assigned_teacher_id: string | null;
  course_name: string | null;
  course_start_date: string | null;
  course_end_date: string | null;
  course_total_sessions: number | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface Teacher {
  profile_id: string;
  bio: string | null;
  specialty: string | null;
  languages: string | null;
  hourly_rate: number | null;
  bank_name: string | null;
  bank_account: string | null;
  account_holder: string | null;
  zoom_url: string | null;
  teams_url: string | null;
  created_at: string;
}

export type AttendanceStatus = "present" | "late" | "absent" | "reschedule" | "other";

export const ATTENDANCE_LABELS_EN: Record<AttendanceStatus, string> = {
  present: "Attended on time",
  late: "Late (up to 15 mins)",
  absent: "Absent",
  reschedule: "Reschedule",
  other: "Other",
};

export const ATTENDANCE_LABELS_KO: Record<AttendanceStatus, string> = {
  present: "출석",
  late: "지각 (15분 이내)",
  absent: "결석",
  reschedule: "일정 변경",
  other: "기타",
};

/**
 * 출석 상태 선택 옵션의 단일 소스(순서 포함).
 * 모든 출석 드롭다운(수업 카드 모달 · Management)이 이 목록을 사용해야
 * 화면 간 옵션이 항상 동일하게 유지된다.
 */
export const ATTENDANCE_OPTIONS: AttendanceStatus[] = [
  "present",
  "late",
  "absent",
  "reschedule",
  "other",
];

export interface Attendance {
  id: string;
  booking_id: string;
  status: AttendanceStatus;
  marked_at: string;
  marked_by: string | null;
  notes: string | null;
}

/**
 * Per-class feedback. Leaf 항목은 별점 1~5로 입력하고, 항목별 가중치를 곱해
 * 점수화한다. 총점 10점 만점:
 *   Delivery(Pronunciation 1 + Pace 1) = 2
 *   Grammar(Accuracy 1 + Complexity 1) = 2
 *   Vocabulary(Diversity 1 + Relevancy 1) = 2
 *   Comprehension = 1
 *   Content & Message(Clarity 1 + Organization 1) = 2
 *   Attitude(Participation 0.5 + Homework 0.5) = 1
 * (tone_manner / preparation 은 구버전 컬럼 — 더 이상 사용하지 않음)
 */
export type FeedbackKey =
  | "delivery_pronunciation"
  | "delivery_pace"
  | "grammar_accuracy"
  | "grammar_complexity"
  | "vocabulary_diversity"
  | "vocabulary_relevancy"
  | "comprehension"
  | "content_clarity"
  | "content_organization"
  | "participation"
  | "homework";

export const FEEDBACK_KEYS: FeedbackKey[] = [
  "delivery_pronunciation",
  "delivery_pace",
  "grammar_accuracy",
  "grammar_complexity",
  "vocabulary_diversity",
  "vocabulary_relevancy",
  "comprehension",
  "content_clarity",
  "content_organization",
  "participation",
  "homework",
];

/** 항목별 배점 (별 5개 만점 = 이 점수). 합계 = 10. */
export const FEEDBACK_WEIGHTS: Record<FeedbackKey, number> = {
  delivery_pronunciation: 1,
  delivery_pace: 1,
  grammar_accuracy: 1,
  grammar_complexity: 1,
  vocabulary_diversity: 1,
  vocabulary_relevancy: 1,
  comprehension: 1,
  content_clarity: 1,
  content_organization: 1,
  participation: 0.5,
  homework: 0.5,
};

/** 상위 영역 정의 (표시 순서 고정). max = 영역 배점 합. */
export const FEEDBACK_AREAS: {
  key: string;
  label: string;
  color: string;
  leaves: FeedbackKey[];
  max: number;
}[] = [
  { key: "delivery",      label: "Delivery",          color: "#7c3aed", leaves: ["delivery_pronunciation", "delivery_pace"], max: 2 },
  { key: "grammar",       label: "Grammar",           color: "#1d4ed8", leaves: ["grammar_accuracy", "grammar_complexity"], max: 2 },
  { key: "vocabulary",    label: "Vocabulary",        color: "#0891b2", leaves: ["vocabulary_diversity", "vocabulary_relevancy"], max: 2 },
  { key: "comprehension", label: "Comprehension",     color: "#059669", leaves: ["comprehension"], max: 1 },
  { key: "content",       label: "Content & Message", color: "#65a30d", leaves: ["content_clarity", "content_organization"], max: 2 },
  { key: "attitude",      label: "Attitude",          color: "#dc2626", leaves: ["participation", "homework"], max: 1 },
];

type ScoreMap = Partial<Record<FeedbackKey, number | null | undefined>>;

/** 영역 획득 점수 (별 1~5 × 가중치/5). 미평가 항목 제외. 전부 미평가면 null. */
export function feedbackAreaPoints(
  scores: ScoreMap,
  leaves: FeedbackKey[],
): number | null {
  let pts = 0, rated = false;
  for (const k of leaves) {
    const v = scores[k];
    if (typeof v === "number") {
      pts += (v / 5) * FEEDBACK_WEIGHTS[k];
      rated = true;
    }
  }
  return rated ? pts : null;
}

/** 총점 (10점 만점). 미평가 항목은 제외하고 평가된 배점 기준으로 10점 환산. */
export function feedbackTotal10(scores: ScoreMap): number | null {
  let pts = 0, w = 0;
  for (const k of FEEDBACK_KEYS) {
    const v = scores[k];
    if (typeof v === "number") {
      pts += (v / 5) * FEEDBACK_WEIGHTS[k];
      w += FEEDBACK_WEIGHTS[k];
    }
  }
  if (w === 0) return null;
  return (pts / w) * 10;
}

export type FeedbackStatus = "draft" | "submitted";

export interface Feedback {
  id: string;
  booking_id: string;
  delivery_pronunciation: number | null;
  delivery_pace: number | null;
  grammar_accuracy: number | null;
  grammar_complexity: number | null;
  vocabulary_diversity: number | null;
  vocabulary_relevancy: number | null;
  comprehension: number | null;
  content_clarity: number | null;
  content_organization: number | null;
  participation: number | null;
  homework: number | null;
  /** @deprecated 구버전 항목 — 더 이상 입력받지 않음 */
  tone_manner: number | null;
  /** @deprecated 구버전 항목 — 더 이상 입력받지 않음 */
  preparation: number | null;
  comment: string | null;
  status: FeedbackStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type FeedbackInput = Partial<Record<FeedbackKey, number | null>> & {
  comment?: string | null;
};

/** Student → Teacher feedback (1 per student-teacher pair) */
export interface StudentTeacherFeedback {
  id: string;
  student_id: string;
  teacher_id: string;
  rating: number | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanySettings {
  company_name: string;
  allowed_class_types: string[];
  allowed_formats: string[];
  allowed_teacher_ids: string[];
  total_sessions: number | null;
  /** true 면 센터가 수강신청을 대행 — 교육생은 신청 화면에서 비활성화 메시지를 봄 */
  center_managed_registration: boolean;
  updated_at: string;
}

export interface CompanyHoliday {
  id: string;
  company_name: string;
  holiday_date: string;     // YYYY-MM-DD
  reason: string | null;
  created_at: string;
}

export interface TimeSlot {
  id: string;
  teacher_id: string;
  start_at: string;
  end_at: string;
  format: ClassFormat;
  class_type: ClassType;
  capacity: number;
  status: SlotStatus;
  slot_duration_minutes: 30 | 60;
  created_at: string;
}

export interface Booking {
  id: string;
  slot_id: string;
  student_id: string;
  status: BookingStatus;
  start_at: string;
  end_at: string;
  created_at: string;
  cancelled_at: string | null;
}

/**
 * 교육생 달력에서 보여줄 "예약 가능한 한 칸" — 강사 가능시간을 slot_duration_minutes 단위로 쪼갠 것.
 */
export interface BookableSlot {
  availability_id: string;     // 원본 time_slots.id
  teacher_id: string;
  teacher_name: string;
  start_at: string;            // 이 작은 칸의 시작
  end_at: string;              // 이 작은 칸의 끝
  format: ClassFormat;
  class_type: ClassType;
  capacity: number;
  status: SlotStatus;
  booked_count: number;        // 이 작은 칸에 들어간 예약 수
  i_am_booked: boolean;        // 본인 예약 여부
  is_past: boolean;            // 이미 지나간 시간 (마감 처리)
  zoom_url: string | null;     // 강사가 설정한 Zoom 회의실 URL (online 일 때 카드/모달에 표시)
  teams_url: string | null;    // 강사가 설정한 Teams 회의실 URL
}
