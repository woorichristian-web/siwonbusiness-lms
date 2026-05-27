import { ImageResponse } from "next/og";

// Android 스플래시 + 고해상도 홈 아이콘 (maskable 호환)
// — satori 기본 Inter 400 만 로드되어 fontWeight 가 무시되므로
//   S 는 SVG path 로 직접 그려서 두께를 보장.
export const runtime = "edge";

// 두꺼운 S 경로 (100x100 viewBox 내)
const S_PATH = "M 75 28 Q 75 10 50 10 Q 25 10 25 30 Q 25 50 50 50 Q 75 50 75 70 Q 75 90 50 90 Q 25 90 25 72";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#1e3a8a",
          borderRadius: 96,
        }}
      >
        {/* 골드 액센트 테두리 — 안전영역 안 */}
        <div
          style={{
            position: "absolute",
            top: 48,
            left: 48,
            right: 48,
            bottom: 48,
            border: "4px solid rgba(251, 191, 36, 0.4)",
            borderRadius: 60,
          }}
        />

        {/* 두꺼운 S — SVG path, stroke-width 18/100 = 18% */}
        <svg
          width="260"
          height="260"
          viewBox="0 0 100 100"
          style={{ position: "absolute", top: 70, left: 126 }}
        >
          <path
            d={S_PATH}
            stroke="#fbbf24"
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>

        {/* BUSINESS — 안전영역 안 (y ~ 350-394) */}
        <div
          style={{
            position: "absolute",
            top: 350,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            fontSize: 44,
            color: "#fbbf24",
            letterSpacing: 9,
          }}
        >
          BUSINESS
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
