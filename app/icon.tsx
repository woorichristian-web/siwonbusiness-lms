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
            fontSize: 50,
            fontWeight: 700,
            color: "#fbbf24",
            fontFamily: "Georgia, serif",
            lineHeight: 1,
          }}
        >
          S
        </div>
      </div>
    ),
    size,
  );
}
