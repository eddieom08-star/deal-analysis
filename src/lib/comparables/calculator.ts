import type {
  EnrichedComparable,
  AreaPriceMetrics,
  CrossReferenceResult,
  PropertyDataSoldPricesPerSqft,
} from "@/lib/types";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function calculateAreaMetrics(
  comparables: EnrichedComparable[],
  postcode: string,
): AreaPriceMetrics | null {
  if (comparables.length === 0) return null;

  const sqftPrices = comparables.map((c) => c.pricePerSqft);
  const sqmPrices = comparables.map((c) => c.pricePerSqm);

  const dates = comparables.map((c) => c.saleDate).sort();

  return {
    meanPricePerSqft: Math.round(
      sqftPrices.reduce((sum, p) => sum + p, 0) / sqftPrices.length,
    ),
    medianPricePerSqft: Math.round(median(sqftPrices)),
    minPricePerSqft: Math.min(...sqftPrices),
    maxPricePerSqft: Math.max(...sqftPrices),
    meanPricePerSqm: Math.round(
      sqmPrices.reduce((sum, p) => sum + p, 0) / sqmPrices.length,
    ),
    medianPricePerSqm: Math.round(median(sqmPrices)),
    sampleCount: comparables.length,
    dateRange: {
      from: dates[0],
      to: dates[dates.length - 1],
    },
    postcode,
  };
}

export function findBestComparables(
  comparables: EnrichedComparable[],
  targetBeds: number | null,
  targetSqft: number | null,
  count: number = 5,
): EnrichedComparable[] {
  if (comparables.length <= count) return comparables;

  const scored = comparables.map((comp) => {
    let score = 0;

    // Recency (newer is better, max 40 points)
    const ageMonths =
      (Date.now() - new Date(comp.saleDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
    score += Math.max(0, 40 - ageMonths * 2);

    // Bedroom match (20 points for exact, 10 for +-1)
    if (targetBeds !== null && comp.bedrooms !== null) {
      const bedDiff = Math.abs(comp.bedrooms - targetBeds);
      if (bedDiff === 0) score += 20;
      else if (bedDiff === 1) score += 10;
    }

    // Size similarity (max 20 points)
    if (targetSqft !== null && comp.floorAreaSqft > 0) {
      const sizeDiff = Math.abs(comp.floorAreaSqft - targetSqft) / targetSqft;
      score += Math.max(0, 20 - sizeDiff * 40);
    }

    // Match confidence (20 points high, 10 medium)
    if (comp.matchConfidence === "high") score += 20;
    else if (comp.matchConfidence === "medium") score += 10;

    return { comp, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((s) => s.comp);
}

export function crossReferenceEvidence(
  propertyDataPerSqft: PropertyDataSoldPricesPerSqft | null,
  areaMetrics: AreaPriceMetrics | null,
): CrossReferenceResult {
  const pdAvg = propertyDataPerSqft?.averagePricePerSqft ?? null;
  const enrichedAvg = areaMetrics?.meanPricePerSqft ?? null;

  if (pdAvg === null && enrichedAvg === null) {
    return {
      propertyDataAvgSqft: null,
      enrichedAvgSqft: null,
      divergencePercent: null,
      agreement: "insufficient_data",
      note: "Neither PropertyData nor LR+EPC data available for cross-reference",
    };
  }

  if (pdAvg === null || enrichedAvg === null) {
    return {
      propertyDataAvgSqft: pdAvg,
      enrichedAvgSqft: enrichedAvg,
      divergencePercent: null,
      agreement: "insufficient_data",
      note: pdAvg === null
        ? "PropertyData not available; using LR+EPC data only"
        : "LR+EPC matching insufficient; using PropertyData only",
    };
  }

  const avg = (pdAvg + enrichedAvg) / 2;
  const divergence = Math.abs(pdAvg - enrichedAvg) / avg;
  const divergencePercent = Math.round(divergence * 100);

  let agreement: CrossReferenceResult["agreement"];
  let note: string;

  if (divergencePercent <= 10) {
    agreement = "high";
    note = `Strong agreement: PropertyData £${pdAvg}/sqft vs LR+EPC £${enrichedAvg}/sqft (${divergencePercent}% divergence)`;
  } else if (divergencePercent <= 20) {
    agreement = "moderate";
    note = `Moderate agreement: PropertyData £${pdAvg}/sqft vs LR+EPC £${enrichedAvg}/sqft (${divergencePercent}% divergence). Using conservative figure.`;
  } else {
    agreement = "low";
    note = `Significant divergence: PropertyData £${pdAvg}/sqft vs LR+EPC £${enrichedAvg}/sqft (${divergencePercent}% divergence). Manual review recommended.`;
  }

  return {
    propertyDataAvgSqft: pdAvg,
    enrichedAvgSqft: enrichedAvg,
    divergencePercent,
    agreement,
    note,
  };
}
