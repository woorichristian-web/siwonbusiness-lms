// 과정 ↔ 수업 시간표(time_slots)·교육생 예약(bookings) 자동 동기화.
// 센터가 과정 정보(요일·시간·기간·강사·수강생)를 저장/오픈하면 이 함수를 호출해서,
// 강사 달력과 교육생 달력에 실제 수업이 뜨도록 슬롯·예약을 만들어 맞춘다.
//   - 과정의 weekdays + day_times(class_time) + duration_min 으로 회차별 시작/종료 계산 (KST)
//   - 지난 수업(이미 시작한 회차)은 건드리지 않음 — 출석·평가 이력 보존
//   - 미래 회차: 없으면 생성, 시간이 바뀌었으면 갱신, 일정에서 빠졌으면 삭제
//   - 등록 교육생 전원에게 confirmed 예약을 맞춰줌 (출석체크는 예약 단위로 이뤄짐)
//   - 기업 휴일(company_holidays)은 건너뜀
// 테스트 과정(is_test)과 강사 미배정 과정은 건너뛰고,
// 강사가 여러 명이면 반 배정이 모호하므로 슬롯 자동 생성은 하지 않는다.
import { createAdminClient } from "@/lib/supabase/admin";

const DOW: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

/** 과정 기간 내 수업 회차들의 시작 시각(UTC ISO) 목록을 계산한다. */
function buildOccurrences(course: {
  start_date: string;
  end_date: string;
  weekdays: string[];
  class_time: string | null;
  day_times: Record<string, string> | null;
  duration_min: number | null;
}, holidays: Set<string>): Array<{ start: Date; end: Date }> {
  const durationMs = (course.duration_min ?? 60) * 60000;
  const out: Array<{ start: Date; end: Date }> = [];
  const wanted = new Map<number, string>(); // dow → "HH:mm"
  for (const d of course.weekdays ?? []) {
    const dow = DOW[d];
    const time = course.day_times?.[d] ?? course.class_time;
    if (dow === undefined || !time) continue;
    wanted.set(dow, String(time).slice(0, 5));
  }
  if (wanted.size === 0) return out;

  // 날짜는 KST 기준으로 순회한다 (start_date/end_date 는 KST 달력 날짜)
  const cur = new Date(`${course.start_date}T00:00:00+09:00`);
  const last = new Date(`${course.end_date}T00:00:00+09:00`);
  while (cur <= last) {
    const kst = new Date(cur.getTime() + 9 * 3600 * 1000);
    const dateStr = kst.toISOString().slice(0, 10);
    const time = wanted.get(kst.getUTCDay());
    if (time && !holidays.has(dateStr)) {
      const start = new Date(`${dateStr}T${time}:00+09:00`);
      out.push({ start, end: new Date(start.getTime() + durationMs) });
    }
    cur.setTime(cur.getTime() + 86400000);
  }
  return out;
}

export async function syncCourseSchedule(courseId: string) {
  try {
    const admin = createAdminClient();

    const { data: course } = await admin
      .from("courses")
      .select("id, company_name, format, class_type, capacity, start_date, end_date, weekdays, class_time, day_times, duration_min, is_test")
      .eq("id", courseId)
      .maybeSingle();
    if (!course || (course as any).is_test) return;
    if (!course.start_date || !course.end_date) return;

    const [{ data: cts }, { data: css }, { data: hols }] = await Promise.all([
      admin.from("course_teachers").select("teacher_id").eq("course_id", courseId).is("assigned_until", null),
      admin.from("course_students").select("student_id").eq("course_id", courseId),
      course.company_name
        ? admin.from("company_holidays").select("holiday_date").eq("company_name", course.company_name)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const teacherIds = Array.from(new Set((cts ?? []).map((r: any) => r.teacher_id)));
    const studentIds = Array.from(new Set((css ?? []).map((r: any) => r.student_id)));
    const holidays = new Set<string>((hols ?? []).map((h: any) => String(h.holiday_date)));

    const now = new Date();
    const nowIso = now.toISOString();
    const capacity = Math.max(course.capacity ?? 0, studentIds.length, 1);
    const format = (course.format as string) || "offline";
    const classType = (course.class_type as string) || "group";

    // 기존 과정 슬롯 (미래 회차만 손댄다)
    const { data: existing } = await admin
      .from("time_slots")
      .select("id, teacher_id, start_at, end_at, format, class_type, capacity")
      .eq("course_id", courseId)
      .gte("start_at", nowIso);
    const existingByStart = new Map<string, any>();
    for (const s of existing ?? []) existingByStart.set(new Date(s.start_at).toISOString(), s);

    // 강사가 정확히 1명일 때만 슬롯을 자동 생성/이동한다 (여러 명이면 반 배정이 모호)
    if (teacherIds.length === 1) {
      const teacherId = teacherIds[0];
      const expected = buildOccurrences(course as any, holidays)
        .filter((o) => o.start > now);
      const expectedKeys = new Set(expected.map((o) => o.start.toISOString()));

      // 일정에서 빠진 미래 슬롯 삭제 (예약은 FK cascade 로 함께 정리)
      const stale = (existing ?? []).filter(
        (s: any) => !expectedKeys.has(new Date(s.start_at).toISOString()),
      );
      if (stale.length > 0) {
        const staleIds = stale.map((s: any) => s.id);
        await admin.from("bookings").delete().in("slot_id", staleIds);
        await admin.from("time_slots").delete().in("id", staleIds);
        for (const s of stale) existingByStart.delete(new Date(s.start_at).toISOString());
      }

      // 새 회차 생성 + 기존 회차 필드 맞춤
      const inserts: any[] = [];
      for (const o of expected) {
        const key = o.start.toISOString();
        const cur = existingByStart.get(key);
        if (!cur) {
          inserts.push({
            teacher_id: teacherId,
            course_id: courseId,
            start_at: key,
            end_at: o.end.toISOString(),
            format,
            class_type: classType,
            capacity,
            status: "open",
          });
        } else if (
          cur.teacher_id !== teacherId ||
          new Date(cur.end_at).toISOString() !== o.end.toISOString() ||
          cur.format !== format ||
          cur.class_type !== classType ||
          cur.capacity !== capacity
        ) {
          await admin
            .from("time_slots")
            .update({
              teacher_id: teacherId,
              end_at: o.end.toISOString(),
              format,
              class_type: classType,
              capacity,
            })
            .eq("id", cur.id);
        }
      }
      if (inserts.length > 0) await admin.from("time_slots").insert(inserts);
    }

    // 예약 동기화: 미래 회차마다 등록 교육생 전원이 confirmed 예약을 갖도록.
    const { data: slots } = await admin
      .from("time_slots")
      .select("id, start_at, end_at")
      .eq("course_id", courseId)
      .gte("start_at", nowIso);
    if ((slots ?? []).length === 0) return;

    const slotIds = (slots ?? []).map((s: any) => s.id);
    const { data: bks } = await admin
      .from("bookings")
      .select("id, slot_id, student_id, status")
      .in("slot_id", slotIds);
    const has = new Set(
      (bks ?? [])
        .filter((b: any) => b.status === "confirmed")
        .map((b: any) => `${b.slot_id}:${b.student_id}`),
    );
    const enrolled = new Set(studentIds);

    // 수강 해제된 교육생의 미래 예약 제거
    const orphan = (bks ?? []).filter((b: any) => !enrolled.has(b.student_id));
    if (orphan.length > 0) {
      await admin.from("bookings").delete().in("id", orphan.map((b: any) => b.id));
    }

    const bookingInserts: any[] = [];
    for (const s of slots ?? []) {
      for (const sid of studentIds) {
        if (has.has(`${s.id}:${sid}`)) continue;
        bookingInserts.push({
          slot_id: s.id,
          student_id: sid,
          start_at: s.start_at,
          end_at: s.end_at,
          status: "confirmed",
          course_id: courseId,
        });
      }
    }
    if (bookingInserts.length > 0) await admin.from("bookings").insert(bookingInserts);
  } catch {
    // 시간표 동기화 실패가 본 작업(과정 저장/오픈)을 막지 않도록 조용히 무시
  }
}
