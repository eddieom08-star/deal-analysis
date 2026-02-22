import { StatusTracker } from "@/components/status-tracker";

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-2xl">
      <a
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 rounded-lg py-2 pr-3 -ml-2 pl-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors min-h-[44px]"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </a>
      <StatusTracker analysisId={id} />
    </div>
  );
}
