import { ImageResponse } from "next/og";

// iOS 'Add to Home Screen' 시 사용되는 아이콘
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const S_PATH = "M 75 28 Q 75 10 50 10 Q 25 10 25 30 Q 25 50 50 50 Q 75 50 75 70 Q 75 90 50 90 Q 25 90 25 72";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#1e3a8a",
          borderRadius: 34,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 17,
            left: 17,
            right: 17,
            bottom: 17,
            border: "2px solid rgba(251, 191, 36, 0.4)",
            borderRadius: 21,
          }}
        />

        <svg
          width="94"
          height="94"
          viewBox="0 0 100 100"
          style={{ position: "absolute", top: 24, left: 43 }}
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
            top: 124,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            fontSize: 15,
            color: "#fbbf24",
            letterSpacing: 3,
          }}
        >
          BUSINESS
        </div>
      </div>
    ),
    size,
  );
}
