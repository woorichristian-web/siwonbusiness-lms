import { ImageResponse } from "next/og";
import { pretendardBold } from "@/lib/ogFont";
import { LOGO_S_PATH } from "@/lib/logoS";

// iOS 'Add to Home Screen' 시 사용되는 아이콘
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
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
          borderRadius: 34,
        }}
      >
        <svg
          width="94"
          height="94"
          viewBox="0 0 100 100"
          style={{ position: "absolute", top: 24, left: 43 }}
        >
          <path d={LOGO_S_PATH} fill="#fbbf24" />
        </svg>

        <div
          style={{
            position: "absolute",
            top: 124,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            fontFamily: "Pretendard",
            fontWeight: 700,
            fontSize: 15,
            color: "#fbbf24",
            letterSpacing: 3,
          }}
        >
          BUSINESS
        </div>
      </div>
    ),
    {
      ...size,
      ...(font
        ? { fonts: [{ name: "Pretendard", data: font, weight: 700 as const, style: "normal" as const }] }
        : {}),
    },
  );
}
