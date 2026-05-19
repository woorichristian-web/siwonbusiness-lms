"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import type { ProgressData } from "@/lib/progress";
import ProgressReport from "@/components/ProgressReport";

export default function CompanyBatchDownloadClient({
  companies,
  selectedCompany,
  reports,
}: {
  companies: string[];
  selectedCompany: string;
  reports: ProgressData[];
}) {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const hiddenRef = useRef<HTMLDivElement>(null);

  function onCompanyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(`/admin/progress/company?company=${encodeURIComponent(e.target.value)}`);
  }

  async function downloadAllAsZip() {
    if (reports.length === 0) return;
    setDownloading(true);
    setProgress({ done: 0, total: reports.length });

    try {
      const zip = new JSZip();
      const date = new Date().toISOString().slice(0, 10);

      // The hidden container has one report element per student (rendered above)
      const nodes = hiddenRef.current?.querySelectorAll<HTMLElement>("[data-report]") ?? [];

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const student = reports[i];
        // capture this node only
        // eslint-disable-next-line no-await-in-loop
        const dataUrl = await toPng(node, {
          backgroundColor: "#f8fafc",
          pixelRatio: 2,
          cacheBust: true,
        });
        // dataUrl: "data:image/png;base64,...."
        const base64 = dataUrl.split(",")[1];
        const safeName = student.studentName.replace(/[^\w가-힣]+/g, "_");
        zip.file(`ProgressReport_${safeName}.png`, base64, { base64: true });
        setProgress({ done: i + 1, total: reports.length });
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const safeCompany = selectedCompany.replace(/[^\w가-힣]+/g, "_");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ProgressReports_${safeCompany}_${date}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("일괄 다운로드 실패. 다시 시도해주세요.");
    } finally {
      setDownloading(false);
      setProgress(null);
    }
  }

  if (companies.length === 0) {
    return (
      <div className="card text-center text-slate-500">아직 등록된 기업이 없습니다.</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 기업 선택 + 일괄 다운로드 */}
      <section className="card flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-slate-700">기업:</label>
        <select className="input max-w-xs" value={selectedCompany} onChange={onCompanyChange}>
          {companies.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="text-xs text-slate-500">교육생 {reports.length}명</span>
        <button
          type="button"
          onClick={downloadAllAsZip}
          disabled={downloading || reports.length === 0}
          className="btn ml-auto"
        >
          {downloading
            ? progress
              ? `생성 중... ${progress.done}/${progress.total}`
              : "준비 중..."
            : `⬇ 전체 ZIP 다운로드 (${reports.length}명)`}
        </button>
      </section>

      {/* 학생별 미리보기 + 개별 다운로드 (각 ProgressReport는 자체 다운 버튼 포함) */}
      {reports.length === 0 ? (
        <div className="card text-center text-slate-500">
          이 기업에 등록된 교육생이 없습니다.
        </div>
      ) : (
        <div ref={hiddenRef} className="space-y-10">
          {reports.map((r) => (
            <div key={r.studentId} data-report>
              <ProgressReport data={r} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
