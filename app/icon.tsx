import { ImageResponse } from "next/og";
import { LOGO_S_PATH } from "@/lib/logoS";

// 브라우저 탭 favicon (작은 사이즈 — S 만, Pretendard Black 글리프)
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

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
        <svg width="52" height="52" viewBox="0 0 100 100">
          <path d={LOGO_S_PATH} fill="#fbbf24" />
        </svg>
      </div>
    ),
    size,
  );
}
