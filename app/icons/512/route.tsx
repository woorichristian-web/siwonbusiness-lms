import { ImageResponse } from "next/og";
import { pretendardBold } from "@/lib/ogFont";
import { LOGO_S_PATH } from "@/lib/logoS";

// Android 스플래시 + 고해상도 홈 아이콘 (maskable 호환)
// — S 는 하이원 원추리체 글리프 외곽선(fill), BUSINESS 는 Pretendard 임베드.
export const runtime = "edge";

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
        {/* S — 하이원 원추리체 글리프 외곽선(fill) */}
        <svg
          width="260"
          height="260"
          viewBox="0 0 100 100"
          style={{ position: "absolute", top: 70, left: 126 }}
        >
          <path d={LOGO_S_PATH} fill="#fbbf24" />
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
