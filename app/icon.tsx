import { ImageResponse } from "next/og";

// 브라우저 탭 favicon (작은 사이즈 — S 만)
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

const S_PATH = "M 76 32 Q 76 16 50 16 Q 24 16 24 33 Q 24 50 50 50 Q 76 50 76 67 Q 76 84 50 84 Q 24 84 24 68";

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
            strokeWidth="26"
            strokeLinecap="butt"
            strokeLinejoin="miter"
            fill="none"
          />
        </svg>
      </div>
    ),
    size,
  );
}
