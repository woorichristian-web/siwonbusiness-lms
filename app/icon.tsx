import { ImageResponse } from "next/og";

// 브라우저 탭 favicon (작은 사이즈 — S 만)
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

const S_PATH = "M 75 28 Q 75 10 50 10 Q 25 10 25 30 Q 25 50 50 50 Q 75 50 75 70 Q 75 90 50 90 Q 25 90 25 72";

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
        <svg width="44" height="44" viewBox="0 0 100 100">
          <path
            d={S_PATH}
            stroke="#fbbf24"
            strokeWidth="20"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
    ),
    size,
  );
}
