"use client";

import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import type { FeedbackKey } from "@/lib/types";
import type { ProgressData, FeedbackPoint } from "@/lib/progress";

/**
 * High-level areas shown on the chart (5 lines instead of 10 leaf categories).
 * Each area's score per session = average of its constituent leaf ratings.
 *
 *   Grammar          = avg(grammar_accuracy, grammar_complexity)
 *   Vocabulary       = avg(vocabulary_diversity, vocabulary_relevancy)
 *   Comprehension    = comprehension
 *   Content & Message = avg(content_clarity, content_organization)
 *   Attitude         = avg(participation, tone_manner, preparation)
 */
type AreaKey =
  | "grammar"
  | "vocabulary"
  | "comprehension"
  | "content"
  | "attitude";

const AREAS: { key: AreaKey; label: string; color: string; leaves: FeedbackKey[]; group: "Language" | "Attitude" }[] = [
  { key: "grammar",       label: "Grammar",          color: "#1d4ed8", group: "Language",
    leaves: ["grammar_accuracy", "grammar_complexity"] },
  { key: "vocabulary",    label: "Vocabulary",       color: "#0891b2", group: "Language",
    leaves: ["vocabulary_diversity", "vocabulary_relevancy"] },
  { key: "comprehension", label: "Comprehension",    color: "#059669", group: "Language",
    leaves: ["comprehension"] },
  { key: "content",       label: "Content & Message", color: "#65a30d", group: "Language",
    leaves: ["content_clarity", "content_organization"] },
  { key: "attitude",      label: "Attitude",         color: "#dc2626", group: "Attitude",
    leaves: ["participation", "tone_manner", "preparation"] },
];

const LABEL_BY_KEY: Record<string, string> = Object.fromEntries(
  AREAS.map((a) => [a.key, a.label])
);

/** Per-session score for one area = mean of its leaf ratings (skip nulls). */
function areaScore(scores: Partial<Record<FeedbackKey, number | null>>, leaves: FeedbackKey[]): number | null {
  const vals = leaves.map((k) => scores[k]).filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return null;
  return vals.reduce((s, n) => s + n, 0) / vals.length;
}

interface ChartPoint {
  bucket: string;
  [key: string]: number | string;
}

/**
 * Aggregates feedback points into chart-ready buckets.
 * - if points <= 8: bucket by ISO week (e.g. "2026-W21")
 * - if points  > 8: bucket by month (e.g. "2026-05")
 *
 * For each bucket, the value of each leaf category is the average of all points in that bucket.
 */
function bucketize(points: FeedbackPoint[]): { mode: "weekly" | "monthly"; data: ChartPoint[] } {
  const mode = points.length > 8 ? "monthly" : "weekly";

  // Group sessions by week/month
  const groups = new Map<string, FeedbackPoint[]>();
  for (const p of points) {
    const d = new Date(p.date);
    const key = mode === "monthly" ? monthKey(d) : weekKey(d);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const entries = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));

  const data: ChartPoint[] = entries.map(([bucket, list]) => {
    const row: ChartPoint = { bucket: humanBucket(bucket, mode) };
    for (const area of AREAS) {
      // For each session in the bucket, compute the area score; then average across sessions
      const sessionScores = list
        .map((p) => areaScore(p.scores, area.leaves))
        .filter((v): v is number => typeof v === "number");
      if (sessionScores.length > 0) {
        row[area.key] = Math.round((sessionScores.reduce((s, n) => s + n, 0) / sessionScores.length) * 100) / 100;
      }
    }
    return row;
  });

  return { mode, data };
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function weekKey(d: Date) {
  // ISO week — quick approximation using year + week number
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function humanBucket(key: string, mode: "weekly" | "monthly") {
  if (mode === "monthly") {
    const [y, m] = key.split("-");
    return `${y}-${m}`;
  }
  return key; // e.g. 2026-W21
}

const T_KO = {
  reportTitle: (n: string) => `📊 학습 리포트 — ${n}`,
  booked: "예약", attended: "출석", absent: "결석", feedback: "피드백",
  attendanceTitle: "출석율",
  attendancePending: "대기 중 — 아직 체크된 수업 없음",
  attendanceValue: (r: number, a: number, t: number) => `${r}% (${a} / ${t})`,
  attendanceNote: "체크된 출석 기준 (리스케쥴·기타 제외).",
  courseTitle: "과정 진행 상황",
  courseValue: (p: number, b: number) => `${p} / ${b}회 진행`,
  overallTitle: "영역별 점수 비교",
  overallSub: "전체 피드백의 영역별 평균 점수 (1~10점)",
  noFeedback: "아직 등록된 피드백이 없습니다.",
  feedbackTitle: "피드백",
  feedbackSub: "강사가 남긴 코멘트 (날짜별)",
  noComment: "아직 강사가 남긴 코멘트가 없습니다.",
  avg: "평균",
  detailsTitle: (n: number) => `📋 피드백 상세 (${n}건)`,
  dateCol: "날짜",
  detailsNote: "각 행은 한 수업입니다. 영역 점수는 세션 평균 (Grammar = 정확성·복잡성 평균 등).",
  download: "⬇ PNG 다운로드", downloading: "이미지 생성 중...",
  locale: "ko-KR",
};
const T_EN: typeof T_KO = {
  reportTitle: (n) => `📊 Progress Report — ${n}`,
  booked: "Booked", attended: "Attended", absent: "Absent", feedback: "Feedback",
  attendanceTitle: "Attendance Rate",
  attendancePending: "Pending — no marked sessions yet",
  attendanceValue: (r, a, t) => `${r}% (${a} of ${t})`,
  attendanceNote: "Based on marked attendance (Reschedule and Other are excluded).",
  courseTitle: "Course Progress",
  courseValue: (p, b) => `${p} / ${b} sessions`,
  overallTitle: "Overall Comparison",
  overallSub: "Average score per area across all feedback (scale 1–10)",
  noFeedback: "No feedback recorded yet.",
  feedbackTitle: "Feedback",
  feedbackSub: "Teacher comments by date",
  noComment: "No teacher comments yet.",
  avg: "Avg",
  detailsTitle: (n) => `📋 Feedback Details (${n} entries)`,
  dateCol: "Date",
  detailsNote: "Each row is one class. Areas show per-session averages (Grammar = avg of Accuracy + Complexity, etc.).",
  download: "⬇ Download PNG", downloading: "Generating...",
  locale: "en-US",
};

export default function ProgressReport({
  data,
  hideDownload = false,
  lang = "en",
}: {
  data: ProgressData;
  /** true 면 PNG 다운로드 버튼을 숨김 (교육생 본인 화면 등) */
  hideDownload?: boolean;
  /** 강사=영어, 교육생·센터=한글 */
  lang?: "ko" | "en";
}) {
  const t = lang === "ko" ? T_KO : T_EN;

  // 강사 코멘트가 있는 피드백만 (최신순)
  const commentPoints = useMemo(
    () =>
      data.feedbackPoints
        .filter((p) => p.comment)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [data.feedbackPoints],
  );

  // Overall area averages across all feedback (used for top bar chart)
  const overallAverages = useMemo(() => {
    return AREAS.map((area) => {
      const sessionScores = data.feedbackPoints
        .map((p) => areaScore(p.scores, area.leaves))
        .filter((v): v is number => typeof v === "number");
      return {
        key: area.key,
        label: area.label,
        color: area.color,
        score:
          sessionScores.length === 0
            ? null
            : Math.round((sessionScores.reduce((s, n) => s + n, 0) / sessionScores.length) * 100) / 100,
      };
    });
  }, [data.feedbackPoints]);

  // 과정 진행 = (진행된 수업 + 리스케쥴) / 예약 총수
  const sessionsLabel = t.courseValue(data.progressedCount, data.bookedCount);
  const courseProgressPct =
    data.bookedCount > 0
      ? Math.min(100, Math.round((data.progressedCount / data.bookedCount) * 100))
      : 0;

  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  async function downloadAsImage() {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(reportRef.current, {
        backgroundColor: "#f8fafc",
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      const safeName = data.studentName.replace(/[^\w가-힣]+/g, "_");
      link.download = `ProgressReport_${safeName}_${date}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
      alert("이미지 생성 실패. 다시 시도해주세요.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      {!hideDownload && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={downloadAsImage}
            disabled={downloading}
            className="btn"
          >
            {downloading ? t.downloading : t.download}
          </button>
        </div>
      )}

      <div ref={reportRef} className="space-y-6 bg-slate-50 p-4">

      {/* Header info */}
      <section className="card">
        <h2 className="mb-3 text-base font-semibold text-slate-800">
          {t.reportTitle(data.studentName)}
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label={t.booked} value={String(data.bookedCount)} />
          <Stat label={t.attended} value={String(data.attendedCount)} />
          <Stat label={t.absent} value={String(data.absentCount)} />
          <Stat label={t.feedback} value={String(data.feedbackPoints.length)} />
        </div>
      </section>

      {/* Attendance progress bar */}
      <section className="card">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">{t.attendanceTitle}</h3>
          <span className="text-sm text-slate-500">
            {data.attendanceRate != null
              ? t.attendanceValue(data.attendanceRate, data.attendedCount, data.markedTotal)
              : t.attendancePending}
          </span>
        </header>
        <div className="h-4 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={
              "h-full transition-all " +
              ((data.attendanceRate ?? 0) >= 80
                ? "bg-emerald-500"
                : (data.attendanceRate ?? 0) >= 60
                  ? "bg-amber-500"
                  : "bg-red-500")
            }
            style={{ width: `${data.attendanceRate ?? 0}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">{t.attendanceNote}</p>
      </section>

      {/* Sessions summary */}
      <section className="card">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">{t.courseTitle}</h3>
          <span className="text-sm text-slate-500">{sessionsLabel}</span>
        </header>
        {data.bookedCount > 0 && (
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${courseProgressPct}%` }}
            />
          </div>
        )}
      </section>

      {/* Overall comparison bar chart */}
      <section className="card">
        <header className="mb-3">
          <h3 className="text-sm font-semibold text-slate-700">{t.overallTitle}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{t.overallSub}</p>
        </header>

        {data.feedbackPoints.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">{t.noFeedback}</p>
        ) : (
          <div className="w-full overflow-x-auto">
            <div style={{ minWidth: 460, height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={overallAverages.filter((a) => a.score != null)}
                  margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: any) => [typeof v === "number" ? v.toFixed(2) : v, "Avg"]}
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {overallAverages.map((a) => (
                      <Cell key={a.key} fill={a.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* 피드백 — 강사 코멘트 (날짜별) */}
      <section className="card">
        <header className="mb-3">
          <h3 className="text-sm font-semibold text-slate-700">{t.feedbackTitle}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{t.feedbackSub}</p>
        </header>

        {commentPoints.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">{t.noComment}</p>
        ) : (
          <ul className="space-y-3">
            {commentPoints.map((p, i) => (
              <li key={i} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-600">
                    {new Date(p.date).toLocaleDateString(t.locale, {
                      year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
                    })}
                  </span>
                  {p.avg != null && (
                    <span className="shrink-0 text-xs font-semibold text-amber-700">
                      {t.avg} {p.avg.toFixed(1)}
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-800">{p.comment}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Feedback details list — verifies data flow across teacher/admin/student views */}
      {data.feedbackPoints.length > 0 && (
        <section className="card">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            {t.detailsTitle(data.feedbackPoints.length)}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-2 py-1 whitespace-nowrap">{t.dateCol}</th>
                  <th className="px-2 py-1">Grammar</th>
                  <th className="px-2 py-1">Vocab</th>
                  <th className="px-2 py-1">Comp</th>
                  <th className="px-2 py-1">Content</th>
                  <th className="px-2 py-1">Attitude</th>
                  <th className="px-2 py-1 font-bold">Avg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.feedbackPoints.map((p, i) => {
                  const grammar = areaScore(p.scores, ["grammar_accuracy", "grammar_complexity"]);
                  const vocab = areaScore(p.scores, ["vocabulary_diversity", "vocabulary_relevancy"]);
                  const comp = areaScore(p.scores, ["comprehension"]);
                  const content = areaScore(p.scores, ["content_clarity", "content_organization"]);
                  const attitude = areaScore(p.scores, ["participation", "tone_manner", "preparation"]);
                  const d = new Date(p.date);
                  return (
                    <tr key={i}>
                      <td className="px-2 py-1 whitespace-nowrap text-slate-700">
                        {d.toLocaleDateString(t.locale, {
                          year: "2-digit", month: "2-digit", day: "2-digit", weekday: "short",
                        })}
                      </td>
                      <td className="px-2 py-1">{grammar?.toFixed(1) ?? "—"}</td>
                      <td className="px-2 py-1">{vocab?.toFixed(1) ?? "—"}</td>
                      <td className="px-2 py-1">{comp?.toFixed(1) ?? "—"}</td>
                      <td className="px-2 py-1">{content?.toFixed(1) ?? "—"}</td>
                      <td className="px-2 py-1">{attitude?.toFixed(1) ?? "—"}</td>
                      <td className="px-2 py-1 font-bold text-amber-700">
                        {p.avg?.toFixed(2) ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">{t.detailsNote}</p>
        </section>
      )}

      </div>{/* end reportRef wrapper */}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-800">{value}</div>
    </div>
  );
}

/**
 * Compact line chart for one area.
 * Y-axis: 0-10. Container is short (~170px) to keep page from scrolling too much.
 * Wrapped in horizontal scroll so mobile users can swipe across long x-axes.
 */
function MiniAreaChart({
  area,
  data,
}: {
  area: { key: string; label: string; color: string };
  data: ChartPoint[];
}) {
  // Compute mini stats (latest, avg) just for this area
  const values = data
    .map((d) => d[area.key])
    .filter((v): v is number => typeof v === "number");
  const latest = values.length === 0 ? null : values[values.length - 1];
  const avg = values.length === 0
    ? null
    : Math.round((values.reduce((s, n) => s + n, 0) / values.length) * 100) / 100;

  // Min width per bucket so x labels don't overlap on mobile
  const minW = Math.max(280, data.length * 50);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: area.color }}
          />
          <span className="text-sm font-semibold text-slate-700">{area.label}</span>
        </div>
        <div className="text-xs text-slate-500">
          {latest != null && (
            <>
              Latest <b className="text-slate-800">{latest.toFixed(1)}</b>
              {avg != null && <span> · Avg {avg.toFixed(1)}</span>}
            </>
          )}
          {latest == null && <span className="text-slate-400">No data</span>}
        </div>
      </header>
      <div className="overflow-x-auto">
        <div style={{ minWidth: minW, height: 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="bucket" tick={{ fontSize: 10 }} interval={0} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} width={28} />
              <Tooltip
                formatter={(v: any) => [typeof v === "number" ? v.toFixed(2) : v, area.label]}
              />
              <Line
                type="monotone"
                dataKey={area.key}
                stroke={area.color}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
