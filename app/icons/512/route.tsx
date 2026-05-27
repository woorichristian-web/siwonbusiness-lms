import { ImageResponse } from "next/og";

// PWA 매니페스트용 512x512 아이콘 (Android 스플래시 + 고해상도 홈 아이콘)
// — maskable 호환을 위해 모든 시각 콘텐츠를 가운데 ~75% (안전영역) 안에 배치
export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#1e3a8a",
          borderRadius: 96,
          position: "relative",
        }}
      >
        {/* 골드 액센트 테두리 — 안전영역 안에 위치 (안쪽 12% 패딩) */}
        <div
          style={{
            position: "absolute",
            top: 60,
            left: 60,
            right: 60,
            bottom: 60,
            border: "4px solid rgba(251, 191, 36, 0.4)",
            borderRadius: 56,
          }}
        />
        {/* 큰 두꺼운 S — Black weight 900, 안전영역 가운데 위쪽 */}
        <div
          style={{
            fontSize: 330,
            fontWeight: 900,
            color: "#fbbf24",
            lineHeight: 1,
            letterSpacing: -14,
            marginTop: -30,
          }}
        >
          S
        </div>
        {/* BUSINESS — S 아래, 안전영역 하단 안쪽 */}
        <div
          style={{
            fontSize: 42,
            fontWeight: 800,
            color: "#fbbf24",
            letterSpacing: 9,
            marginTop: 8,
          }}
        >
          BUSINESS
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
