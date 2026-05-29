import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "Siwon Business LMS",
  description: "기업 영어 교육 LMS",
  manifest: "/manifest.json",
  // app/icon.tsx, app/apple-icon.tsx 가 자동으로 icon meta 를 생성하므로
  // 여기서는 SVG 마스터 파일만 명시적으로 추가 (브라우저별 우선순위 보강).
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Siwon Business",
    statusBarStyle: "black-translucent",
  },
  applicationName: "Siwon Business",
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1e3a8a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        {children}
        {/* 앱 실행 스플래시 — 네이티브 스플래시 뒤 약 1.8초 더 로고를 보여준 뒤 페이드아웃.
            전체 페이지 로드 시에만 나타나며 (SPA 내부 이동에서는 재생 안 됨) CSS 만으로 동작. */}
        <div className="app-splash" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/512?v=5" alt="" width={176} height={176} />
        </div>
        <PwaRegister />
      </body>
    </html>
  );
}
