// 과정 진도 계산 — "어디까지, 어떤 내용까지 수업했나".
// 진행된 세션 = 출석체크(리스케쥴 제외)가 하나라도 있는 수업 세션(슬롯·시각 단위).
// 현재 진도 차시 번호에 해당하는 커리큘럼 topic 을 함께 반환한다.

export interface CourseProgressInfo {
  completed: number;            // 진행된 세션 수
  total: number | null;         // 총 차시 (courses.total_sessions ?? 커리큘럼 수)
  lastTopic: string | null;     // 마지막으로 진행한 차시의 커리큘럼 주제
  nextTopic: string | null;     // 다음 차시 주제
}

/** courseIds 의 진도 맵을 계산한다. supabase 는 admin 권한 클라이언트 권장. */
export async function getCourseProgressMap(
  supabase: any,
  courseIds: string[],
): Promise<Map<string, CourseProgressInfo>> {
  const out = new Map<string, CourseProgressInfo>();
  if (courseIds.length === 0) return out;

  const [{ data: courses }, { data: curriculum }, { data: bookings }] = await Promise.all([
    supabase.from("courses").select("id, total_sessions").in("id", courseIds),
    supabase
      .from("course_curriculum")
      .select("course_id, session_no, topic")
      .in("course_id", courseIds),
    supabase
      .from("bookings")
      .select("id, slot_id, start_at, course_id")
      .in("course_id", courseIds)
      .eq("status", "confirmed"),
  ]);

  const bIds = (bookings ?? []).map((b: any) => b.id);
  const attOk = new Set<string>();
  if (bIds.length > 0) {
    // IN 절이 너무 길어지지 않게 분할 조회
    for (let i = 0; i < bIds.length; i += 500) {
      const { data: atts } = await supabase
        .from("attendance")
        .select("booking_id, status")
        .in("booking_id", bIds.slice(i, i + 500));
      for (const a of atts ?? [])
        if (a.status !== "reschedule") attOk.add(a.booking_id);
    }
  }

  // 과정별 진행 세션 수 (슬롯|시각 distinct)
  const doneSessions = new Map<string, Set<string>>();
  for (const b of bookings ?? []) {
    if (!attOk.has(b.id)) continue;
    (doneSessions.get(b.course_id) ??
      doneSessions.set(b.course_id, new Set()).get(b.course_id)!)
      .add(`${b.slot_id}|${b.start_at}`);
  }

  const currByCourse = new Map<string, Map<number, string>>();
  for (const r of curriculum ?? []) {
    if (r.session_no == null) continue;
    (currByCourse.get(r.course_id) ??
      currByCourse.set(r.course_id, new Map()).get(r.course_id)!)
      .set(r.session_no, r.topic ?? "");
  }

  for (const c of courses ?? []) {
    const completed = doneSessions.get(c.id)?.size ?? 0;
    const curr = currByCourse.get(c.id);
    const currCount = curr ? curr.size : 0;
    out.set(c.id, {
      completed,
      total: c.total_sessions ?? (currCount || null),
      lastTopic: completed > 0 ? (curr?.get(completed) ?? null) : null,
      nextTopic: curr?.get(completed + 1) ?? null,
    });
  }
  return out;
}

/** "3/21차시 · 최근: OOO" 형태 요약 문자열 */
export function progressLabel(p: CourseProgressInfo | undefined | null): string {
  if (!p) return "—";
  const head = `${p.completed}${p.total != null ? ` / ${p.total}` : ""}차시 진행`;
  return p.lastTopic ? `${head} · 최근: ${p.lastTopic}` : head;
}
