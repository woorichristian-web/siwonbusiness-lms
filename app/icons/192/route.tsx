import { ImageResponse } from "next/og";
import { pretendardBold } from "@/lib/ogFont";
import { LOGO_S_PATH } from "@/lib/logoS";

// PWA 192x192 아이콘 (maskable 호환)
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
          borderRadius: 36,
        }}
      >
        <svg
          width="100"
          height="100"
          viewBox="0 0 100 100"
          style={{ position: "absolute", top: 26, left: 46 }}
        >
          <path d={LOGO_S_PATH} fill="#fbbf24" />
        </svg>

        <div
          style={{
            position: "absolute",
            top: 132,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            fontFamily: "Pretendard",
            fontWeight: 700,
            fontSize: 17,
            color: "#fbbf24",
            letterSpacing: 3.5,
          }}
        >
          BUSINESS
        </div>
      </div>
    ),
    {
      width: 192,
      height: 192,
      ...(font
        ? { fonts: [{ name: "Pretendard", data: font, weight: 700 as const, style: "normal" as const }] }
        : {}),
    },
  );
}
