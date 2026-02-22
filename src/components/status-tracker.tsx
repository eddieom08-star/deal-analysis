"use client";

import { useState, useEffect } from "react";

interface StatusData {
  id: string;
  status: string;
  error: string | null;
  pdfs: {
    investmentMemoUrl: string | null;
    valuationMemoUrl: string | null;
  };
  listing: {
    address: string;
    price: string;
    propertyType: string;
  } | null;
  investmentMemo: {
    recommendation: string;
    keyMetrics: {
      purchasePrice: number;
      splitGDV: number;
      grossProfit: number;
      roi: number;
    };
  } | null;
}

const STEP_LABELS: Record<string, string> = {
  pending: "Queued",
  scraping: "Scraping Rightmove listing...",
  fetching_data: "Fetching comparable evidence...",
  enriching_comparables: "Building enriched comparables...",
  analyzing_investment: "Generating Investment Memo (Claude)...",
  analyzing_valuation: "Generating Valuation Memo (Claude)...",
  generating_pdfs: "Rendering PDF reports...",
  uploading: "Uploading files...",
  emailing: "Sending email...",
  complete: "Analysis complete",
  failed: "Analysis failed",
};

const STEP_ORDER = [
  "pending",
  "scraping",
  "fetching_data",
  "enriching_comparables",
  "analyzing_investment",
  "analyzing_valuation",
  "generating_pdfs",
  "uploading",
  "emailing",
  "complete",
];

function fmtCurrency(amount: number): string {
  return `£${amount.toLocaleString("en-GB")}`;
}

export function StatusTracker({ analysisId }: { analysisId: string }) {
  const [data, setData] = useState<StatusData | null>(null);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!polling) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/analyze/${analysisId}/status`);
        if (res.ok) {
          const result: StatusData = await res.json();
          setData(result);
          if (result.status === "complete" || result.status === "failed") {
            setPolling(false);
          }
        }
      } catch {
        // Retry on network error
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [analysisId, polling]);

  if (!data) {
    return (
      <div className="flex items-center gap-3 text-zinc-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
        Loading...
      </div>
    );
  }

  const currentIdx = STEP_ORDER.indexOf(data.status);
  const isComplete = data.status === "complete";
  const isFailed = data.status === "failed";
  const recColor =
    data.investmentMemo?.recommendation === "PROCEED"
      ? "text-green-400"
      : data.investmentMemo?.recommendation === "REJECT"
        ? "text-red-400"
        : "text-amber-400";

  return (
    <div className="space-y-8">
      {/* Property Info */}
      {data.listing && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">{data.listing.address}</h2>
          <p className="mt-1 text-zinc-400">
            {data.listing.price} - {data.listing.propertyType}
          </p>
        </div>
      )}

      {/* Progress Steps */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
        <h3 className="mb-4 text-sm font-medium text-zinc-400">Progress</h3>
        <div className="space-y-3">
          {STEP_ORDER.filter((s) => s !== "pending").map((step, idx) => {
            const stepIdx = idx + 1;
            const isDone = currentIdx > stepIdx;
            const isActive = data.status === step;
            const isFutureStep = currentIdx < stepIdx;

            return (
              <div key={step} className="flex items-center gap-3">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isDone
                      ? "bg-green-500/20 text-green-400"
                      : isActive
                        ? "bg-blue-500/20 text-blue-400"
                        : isFailed && isActive
                          ? "bg-red-500/20 text-red-400"
                          : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {isDone ? (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isActive && !isFailed ? (
                    <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-400" />
                  ) : (
                    <span>{stepIdx}</span>
                  )}
                </div>
                <span
                  className={`text-sm ${
                    isDone
                      ? "text-zinc-400"
                      : isActive
                        ? "font-medium text-zinc-100"
                        : "text-zinc-600"
                  }`}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {isFailed && data.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 sm:p-6">
          <h3 className="font-medium text-red-400">Analysis Failed</h3>
          <p className="mt-2 text-sm text-red-300">{data.error}</p>
        </div>
      )}

      {/* Results */}
      {isComplete && data.investmentMemo && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-400">Key Metrics</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${recColor} ${
                data.investmentMemo.recommendation === "PROCEED"
                  ? "bg-green-500/10"
                  : data.investmentMemo.recommendation === "REJECT"
                    ? "bg-red-500/10"
                    : "bg-amber-500/10"
              }`}>
                {data.investmentMemo.recommendation.replace(/_/g, " ")}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-zinc-500">Purchase Price</p>
                <p className="text-lg font-semibold">
                  {fmtCurrency(data.investmentMemo.keyMetrics.purchasePrice)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Split GDV</p>
                <p className="text-lg font-semibold">
                  {fmtCurrency(data.investmentMemo.keyMetrics.splitGDV)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Gross Profit</p>
                <p className="text-lg font-semibold text-green-400">
                  {fmtCurrency(data.investmentMemo.keyMetrics.grossProfit)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">ROI</p>
                <p className="text-lg font-semibold">
                  {data.investmentMemo.keyMetrics.roi.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Downloads */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
            <h3 className="mb-4 text-sm font-medium text-zinc-400">
              Download Reports
            </h3>
            <div className="flex flex-col gap-3 sm:flex-row">
              {data.pdfs.investmentMemoUrl && (
                <a
                  href={data.pdfs.investmentMemoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Investment Memo PDF
                </a>
              )}
              {data.pdfs.valuationMemoUrl && (
                <a
                  href={data.pdfs.valuationMemoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-zinc-700 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Valuation Memo PDF
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
