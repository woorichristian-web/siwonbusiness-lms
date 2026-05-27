import { ImageResponse } from "next/og";

// PWA 매니페스트용 512x512 아이콘 (splash screen + 고해상도 홈 아이콘)
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
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            right: 24,
            bottom: 24,
            border: "3px solid rgba(251, 191, 36, 0.45)",
            borderRadius: 76,
          }}
        />
        <div
          style={{
            fontSize: 370,
            fontWeight: 700,
            color: "#fbbf24",
            fontFamily: "Georgia, serif",
            lineHeight: 1,
            marginTop: -20,
          }}
        >
          S
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: "#fbbf24",
            letterSpacing: 10,
            marginTop: 10,
          }}
        >
          BUSINESS
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
