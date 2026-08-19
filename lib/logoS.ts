// 로고 'S' — 두꺼운 획 + 각진(butt) 단면의 지오메트릭 S.
// 0 0 100 100 viewBox 기준 중심선 path 로, stroke 로 렌더링한다:
// <svg viewBox="0 0 100 100">
//   <path d={LOGO_S_PATH} stroke="#fbbf24" strokeWidth={LOGO_S_STROKE_WIDTH}
//         strokeLinecap="butt" strokeLinejoin="miter" fill="none" />
// </svg>
export const LOGO_S_PATH =
  "M 76 32 Q 76 16 50 16 Q 24 16 24 33 Q 24 50 50 50 Q 76 50 76 67 Q 76 84 50 84 Q 24 84 24 68";
export const LOGO_S_STROKE_WIDTH = 26;
