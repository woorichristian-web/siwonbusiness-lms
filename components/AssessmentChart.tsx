"use client";

// Initial vs Final 점수 비교 막대 그래프 (순수 SVG — 라이브러리 없음).
// 10개 카테고리 × 2 시리즈(Initial 하늘색 / Final 주황색), Y축 0~10.
// 모바일에서는 부모의 overflow-x-auto 안에서 가로 스크롤된다.
import { ASSESSMENT_ITEMS } from "@/lib/assessment";

const INITIAL_COLOR = "#38bdf8"; // sky-400
const FINAL_COLOR = "#f97316"; // orange-500

export default function AssessmentChart({
  initial,
  final: finalScores,
  title,
  height = 220,
}: {
  /** 카테고리 key → 점수(또는 평균). 없으면 미표시 */
  initial: Record<string, number | null | undefined> | null;
  final: Record<string, number | null | undefined> | null;
  title?: string;
  height?: number;
}) {
  const W = 760;
  const H = height;
  const padL = 28;
  const padR = 8;
  const padT = title ? 26 : 10;
  const padB = 58;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = ASSESSMENT_ITEMS.length;
  const groupW = plotW / n;
  const barW = Math.min(16, groupW / 3);

  const y = (v: number) => padT + plotH - (v / 10) * plotH;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="min-w-[560px]"
        style={{ width: "100%", height: "auto" }}
        role="img"
        aria-label={title ?? "Initial vs Final scores"}
      >
        {title && (
          <text x={W / 2} y={16} textAnchor="middle" fontSize={13} fontWeight={700} fill="#334155">
            {title}
          </text>
        )}
        {/* Y 격자 + 라벨 */}
        {Array.from({ length: 6 }, (_, i) => i * 2).map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={padL - 5} y={y(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8">
              {v}
            </text>
          </g>
        ))}
        {/* 막대 + X 라벨 */}
        {ASSESSMENT_ITEMS.map((it, i) => {
          const cx = padL + groupW * i + groupW / 2;
          const iv = initial?.[it.key];
          const fv = finalScores?.[it.key];
          return (
            <g key={it.key}>
              {typeof iv === "number" && iv > 0 && (
                <rect
                  x={cx - barW - 1.5}
                  y={y(iv)}
                  width={barW}
                  height={plotH + padT - y(iv)}
                  rx={2}
                  fill={INITIAL_COLOR}
                />
              )}
              {typeof fv === "number" && fv > 0 && (
                <rect
                  x={cx + 1.5}
                  y={y(fv)}
                  width={barW}
                  height={plotH + padT - y(fv)}
                  rx={2}
                  fill={FINAL_COLOR}
                />
              )}
              <text
                transform={`translate(${cx}, ${padT + plotH + 8}) rotate(-35)`}
                textAnchor="end"
                fontSize={8.5}
                fill="#64748b"
              >
                {it.short}
              </text>
            </g>
          );
        })}
        {/* 범례 */}
        <g transform={`translate(${W / 2 - 70}, ${H - 10})`}>
          <rect x={0} y={-8} width={10} height={10} rx={2} fill={INITIAL_COLOR} />
          <text x={14} y={0} fontSize={10} fill="#475569">Initial</text>
          <rect x={62} y={-8} width={10} height={10} rx={2} fill={FINAL_COLOR} />
          <text x={76} y={0} fontSize={10} fill="#475569">Final</text>
        </g>
      </svg>
    </div>
  );
}
