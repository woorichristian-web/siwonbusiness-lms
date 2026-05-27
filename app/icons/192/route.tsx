import { ImageResponse } from "next/og";

// PWA 매니페스트용 192x192 아이콘 (maskable 호환 — 안전영역 안에 콘텐츠 배치)
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
          borderRadius: 36,
          position: "relative",
        }}
      >
        {/* 골드 액센트 — 안전영역 안에 위치 */}
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            right: 20,
            bottom: 20,
            border: "1.5px solid rgba(251, 191, 36, 0.4)",
            borderRadius: 22,
          }}
        />
        <div
          style={{
            fontSize: 122,
            fontWeight: 900,
            color: "#fbbf24",
            lineHeight: 1,
            letterSpacing: -5,
            marginTop: -6,
          }}
        >
          S
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: "#fbbf24",
            letterSpacing: 3,
            marginTop: 4,
          }}
        >
          BUSINESS
        </div>
      </div>
    ),
    { width: 192, height: 192 },
  );
}
