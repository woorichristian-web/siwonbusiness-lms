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
        {/* 내부 골드 액센트 테두리 */}
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            right: 8,
            bottom: 8,
            border: "1.5px solid rgba(251, 191, 36, 0.45)",
            borderRadius: 27,
          }}
        />
        {/* 큰 S */}
        <div
          style={{
            fontSize: 130,
            fontWeight: 700,
            color: "#fbbf24",
            fontFamily: "Georgia, serif",
            lineHeight: 1,
            marginTop: -8,
          }}
        >
          S
        </div>
        {/* BUSINESS 텍스트 (직선 — 작은 사이즈 가독성 최우선) */}
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#fbbf24",
            letterSpacing: 3,
            marginTop: 4,
          }}
        >
          BUSINESS
        </div>
      </div>
    ),
    size,
  );
}
