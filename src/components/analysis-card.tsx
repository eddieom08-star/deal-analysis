import type { AnalysisRecord } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { DeleteAnalysisButton } from "./delete-analysis-button";

function fmtCurrency(amount: number): string {
  return `£${amount.toLocaleString("en-GB")}`;
}

export function AnalysisCard({ analysis }: { analysis: AnalysisRecord }) {
  const isComplete = analysis.status === "complete";
  const isFailed = analysis.status === "failed";
  const isProcessing = !isComplete && !isFailed;

  const address =
    analysis.listing?.address.displayAddress ||
    analysis.input.rightmoveUrl.split("/").pop() ||
    "Processing...";

  const rec = analysis.investmentMemo?.recommendation;
  const recColor =
    rec === "PROCEED"
      ? "bg-green-500/10 text-green-400"
      : rec === "REJECT"
        ? "bg-red-500/10 text-red-400"
        : rec === "PROCEED_WITH_CONDITIONS"
          ? "bg-amber-500/10 text-amber-400"
          : "";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-zinc-700 hover:bg-zinc-800/50">
      <div className="flex items-start justify-between gap-4">
        <a href={`/analysis/${analysis.id}`} className="min-w-0 flex-1">
          <h3 className="truncate font-medium">{address}</h3>
          <p className="mt-1 text-sm text-zinc-500">
            {formatDistanceToNow(new Date(analysis.createdAt), {
              addSuffix: true,
            })}
            {analysis.listing && ` - ${analysis.listing.displayPrice}`}
          </p>
        </a>

        <div className="flex items-center gap-2">
          {isProcessing && (
            <span className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
              Processing
            </span>
          )}

          {isFailed && (
            <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400">
              Failed
            </span>
          )}

          {isComplete && rec && (
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${recColor}`}>
              {rec.replace(/_/g, " ")}
            </span>
          )}

          <DeleteAnalysisButton analysisId={analysis.id} />
        </div>
      </div>

      <a href={`/analysis/${analysis.id}`} className="block">
        {isComplete && analysis.investmentMemo && (
          <div className="mt-4 flex gap-6 text-sm">
            <div>
              <span className="text-zinc-500">Profit </span>
              <span className="font-medium text-green-400">
                {fmtCurrency(analysis.investmentMemo.keyMetrics.grossProfit)}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">ROI </span>
              <span className="font-medium">
                {analysis.investmentMemo.keyMetrics.roi.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-zinc-500">GDV </span>
              <span className="font-medium">
                {fmtCurrency(analysis.investmentMemo.keyMetrics.splitGDV)}
              </span>
            </div>
          </div>
        )}

        {isComplete && analysis.pdfs && (
          <div className="mt-3 flex gap-2">
            {analysis.pdfs.investmentMemoUrl && (
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                Investment Memo
              </span>
            )}
            {analysis.pdfs.valuationMemoUrl && (
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                Valuation Memo
              </span>
            )}
            {analysis.emailSentAt && (
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                Emailed
              </span>
            )}
          </div>
        )}
      </a>
    </div>
  );
}
