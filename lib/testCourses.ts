// 테스트 과정(is_test) — 센터 전용. 강사·교육생 화면에서는 이 과정과
// 연결된 수업·예약·설문·대화방이 모두 숨겨진다.
// 0033 마이그레이션 적용 전(컬럼 없음)에는 빈 Set 을 반환해 아무것도 숨기지 않는다.

/** 테스트 과정 id 집합 조회 (강사·교육생 페이지에서 필터링용) */
export async function getTestCourseIds(supabase: any): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from("courses")
      .select("id")
      .eq("is_test", true);
    if (error) return new Set();
    return new Set((data ?? []).map((r: any) => r.id as string));
  } catch {
    return new Set();
  }
}
