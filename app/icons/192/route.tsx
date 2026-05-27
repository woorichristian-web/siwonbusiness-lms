import { ImageResponse } from "next/og";

// PWA 192x192 아이콘 (maskable 호환)
export const runtime = "edge";

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
          borderRadius: 36,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 18,
            left: 18,
            right: 18,
            bottom: 18,
            border: "2px solid rgba(251, 191, 36, 0.4)",
            borderRadius: 22,
          }}
        />

        <svg
          width="100"
          height="100"
          viewBox="0 0 100 100"
          style={{ position: "absolute", top: 26, left: 46 }}
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

        <div
          style={{
            position: "absolute",
            top: 132,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            fontSize: 17,
            color: "#fbbf24",
            letterSpacing: 3.5,
          }}
        >
          BUSINESS
        </div>
      </div>
    ),
    { width: 192, height: 192 },
  );
}
