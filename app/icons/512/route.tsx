import { ImageResponse } from "next/og";
import { pretendardBold } from "@/lib/ogFont";

// Android 스플래시 + 고해상도 홈 아이콘 (maskable 호환)
// — S 는 SVG path 로 직접 그려 두께를 보장, BUSINESS 는 Pretendard 임베드.
export const runtime = "edge";

// 두꺼운 S 경로 (100x100 viewBox 내)
const S_PATH = "M 75 28 Q 75 10 50 10 Q 25 10 25 30 Q 25 50 50 50 Q 75 50 75 70 Q 75 90 50 90 Q 25 90 25 72";

export async function GET() {
  const font = await pretendardBold();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#1e3a8a",
          borderRadius: 96,
        }}
      >
        {/* 두꺼운 S — SVG path, stroke-width 18/100 = 18% */}
        <svg
          width="260"
          height="260"
          viewBox="0 0 100 100"
          style={{ position: "absolute", top: 70, left: 126 }}
        >
          <path
            d={S_PATH}
            stroke="#fbbf24"
            strokeWidth="18"
            strokeLinecap="butt"
            strokeLinejoin="miter"
            fill="none"
          />
        </svg>

        {/* BUSINESS — 안전영역 안 (y ~ 350-394), Pretendard 직선 */}
        <div
          style={{
            position: "absolute",
            top: 350,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            fontFamily: "Pretendard",
            fontWeight: 700,
            fontSize: 44,
            color: "#fbbf24",
            letterSpacing: 9,
          }}
        >
          BUSINESS
        </div>
      </div>
    ),
    {
      width: 512,
      height: 512,
      ...(font
        ? { fonts: [{ name: "Pretendard", data: font, weight: 700 as const, style: "normal" as const }] }
        : {}),
    },
  );
}
