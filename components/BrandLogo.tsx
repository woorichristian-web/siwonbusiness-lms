import { LOGO_S_PATH } from "@/lib/logoS";

/** 앱 로고 (파란 라운드 사각 + Pretendard Black S + BUSINESS 호) — 인라인 SVG 라 항상 즉시 렌더링된다. */
export default function BrandLogo({
  size = 104,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      role="img"
      aria-label="Siwon Business 로고"
    >
      <rect width="512" height="512" rx="96" fill="#1e3a8a" />
      <g transform="translate(126, 70) scale(2.6)">
        <path d={LOGO_S_PATH} fill="#fbbf24" />
      </g>
      <defs>
        <path id="brand-arc-business" d="M 130 360 Q 256 415 382 360" fill="none" />
      </defs>
      <text
        fontFamily="'Pretendard Variable', Pretendard, -apple-system, 'Helvetica Neue', Arial, sans-serif"
        fontSize="38"
        fontWeight="800"
        letterSpacing="6"
        fill="#fbbf24"
      >
        <textPath href="#brand-arc-business" startOffset="50%" textAnchor="middle">
          BUSINESS
        </textPath>
      </text>
    </svg>
  );
}
