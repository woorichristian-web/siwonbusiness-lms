import { ImageResponse } from "next/og";

// iOS 'Add to Home Screen' 시 사용되는 아이콘
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          borderRadius: 34,
          position: "relative",
        }}
      >
        {/* 내부 골드 액센트 테두리 — 안전영역 안에 위치 */}
        <div
          style={{
            position: "absolute",
            top: 18,
            left: 18,
            right: 18,
            bottom: 18,
            border: "1.5px solid rgba(251, 191, 36, 0.4)",
            borderRadius: 22,
          }}
        />
        {/* 큰 두꺼운 S — Black weight */}
        <div
          style={{
            fontSize: 115,
            fontWeight: 900,
            color: "#fbbf24",
            lineHeight: 1,
            letterSpacing: -5,
            marginTop: -6,
          }}
        >
          S
        </div>
        {/* BUSINESS 텍스트 — 굵게 */}
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "#fbbf24",
            letterSpacing: 2.5,
            marginTop: 2,
          }}
        >
          BUSINESS
        </div>
      </div>
    ),
    size,
  );
}
