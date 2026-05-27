import { ImageResponse } from "next/og";

// 브라우저 탭 favicon (작은 사이즈 — S 만)
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1e3a8a",
          borderRadius: 12,
        }}
      >
        <div
          style={{
            fontSize: 54,
            fontWeight: 900,
            color: "#fbbf24",
            lineHeight: 1,
            letterSpacing: -3,
          }}
        >
          S
        </div>
      </div>
    ),
    size,
  );
}
