import { ImageResponse } from "next/og";

// PWA 매니페스트용 192x192 아이콘
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
        <div
          style={{
            position: "absolute",
            top: 9,
            left: 9,
            right: 9,
            bottom: 9,
            border: "1.5px solid rgba(251, 191, 36, 0.45)",
            borderRadius: 29,
          }}
        />
        <div
          style={{
            fontSize: 140,
            fontWeight: 700,
            color: "#fbbf24",
            fontFamily: "Georgia, serif",
            lineHeight: 1,
            marginTop: -8,
          }}
        >
          S
        </div>
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "#fbbf24",
            letterSpacing: 3.5,
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
