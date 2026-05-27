// 공통 DB 타입.

export type Role = "student" | "teacher" | "admin";
export type ClassFormat = "online" | "offline";
export type ClassType = "1on1" | "small_group";
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

export interface Attendance {
  id: string;
  booking_id: string;
  status: AttendanceStatus;
  marked_at: string;
  marked_by: string | null;
  notes: string | null;
}

/**
 * Per-class feedback. Only leaf categories are scored (1-5).
 * Total 10 ratings + free-form comment.
 */
export type FeedbackKey =
  | "grammar_accuracy"
  | "grammar_complexity"
  | "vocabulary_diversity"
  | "vocabulary_relevancy"
  | "comprehension"
  | "content_clarity"
  | "content_organization"
  | "participation"
  | "tone_manner"
  | "preparation";

export const FEEDBACK_KEYS: FeedbackKey[] = [
  "grammar_accuracy",
  "grammar_complexity",
  "vocabulary_diversity",
  "vocabulary_relevancy",
  "comprehension",
  "content_clarity",
  "content_organization",
  "participation",
  "tone_manner",
  "preparation",
];

export type FeedbackStatus = "draft" | "submitted";

export interface Feedback {
  id: string;
  booking_id: string;
  grammar_accuracy: number | null;
  grammar_complexity: number | null;
  vocabulary_diversity: number | null;
  vocabulary_relevancy: number | null;
  comprehension: number | null;
  content_clarity: number | null;
  content_organization: number | null;
  participation: number | null;
  tone_manner: number | null;
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
