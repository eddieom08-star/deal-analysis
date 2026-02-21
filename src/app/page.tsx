import { listAnalyses } from "@/lib/storage/blob";
import { AnalysisCard } from "@/components/analysis-card";
import type { AnalysisRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let analyses: AnalysisRecord[];
  try {
    analyses = await listAnalyses();
  } catch {
    analyses = [];
  }

  // Group by street-postcode
  const grouped: Record<string, typeof analyses> = {};
  for (const a of analyses) {
    const street = a.listing?.address.street || "Processing";
    const postcode = a.listing?.address.postcode || "";
    const key = postcode ? `${street}, ${postcode}` : street;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analyses</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {analyses.length} total
          </p>
        </div>
      </div>

      {analyses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 py-16 text-center">
          <p className="text-zinc-400">No analyses yet.</p>
          <a
            href="/submit"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            Start your first analysis
          </a>
        </div>
      ) : (
        Object.entries(grouped).map(([location, items]) => (
          <div key={location}>
            <h2 className="mb-3 text-sm font-medium text-zinc-400">
              {location}
            </h2>
            <div className="space-y-3">
              {items.map((a) => (
                <AnalysisCard key={a.id} analysis={a} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
