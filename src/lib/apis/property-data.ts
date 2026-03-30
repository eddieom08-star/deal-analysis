import type {
  PropertyDataSoldPrices,
  PropertyDataSoldPricesPerSqft,
  PropertyDataValuation,
} from "@/lib/types";
import { withRetry } from "@/lib/utils/retry";
import { propertyDataCircuit } from "@/lib/utils/circuit-breaker";

const BASE_URL = "https://api.propertydata.co.uk";

function apiKey(): string {
  const key = process.env.PROPERTY_DATA_API_KEY;
  if (!key) throw new Error("PropertyData skipped: PROPERTY_DATA_API_KEY not configured");
  return key;
}

async function fetchRaw(
  endpoint: string,
  params: Record<string, string | number | undefined>,
): Promise<any> {
  return await propertyDataCircuit.execute(() =>
    withRetry(async () => {
      const url = new URL(`${BASE_URL}/${endpoint}`);
      url.searchParams.set("key", apiKey());

      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) {
          url.searchParams.set(k, String(v));
        }
      }

      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `PropertyData ${endpoint} returned ${response.status}: ${text}`,
        );
      }

      let data: any;
      try {
        data = await response.json();
      } catch (error) {
        throw new Error(`Failed to parse JSON from PropertyData API: ${error instanceof Error ? error.message : 'Unknown'}`);
      }

      if (data.status === "error") {
        throw new Error(
          `PropertyData ${endpoint} error: ${data.message || "Unknown error"}`,
        );
      }

      return data;
    }, {
      maxAttempts: 3,
      initialDelay: 1000,
    })
  );
}

// ─── Sold Prices ────────────────────────────────────────────────────────────

export interface SoldPricesOptions {
  type?: "flat" | "detached" | "semi-detached" | "terraced";
  tenure?: "freehold" | "leasehold";
  maxAge?: number;
  bedrooms?: number;
  points?: number;
}

export async function getSoldPrices(
  postcode: string,
  options: SoldPricesOptions = {},
): Promise<PropertyDataSoldPrices> {
  const raw = await fetchRaw("sold-prices", {
    postcode,
    type: options.type,
    tenure: options.tenure,
    max_age: options.maxAge,
    bedrooms: options.bedrooms,
    points: options.points,
  });

  // Actual API shape: { status, postcode, data: { points_analysed, radius, average, raw_data: [...] } }
  const inner = raw.data || {};
  const rawData = Array.isArray(inner.raw_data) ? inner.raw_data : [];

  return {
    postcode: raw.postcode || postcode,
    pointsAnalysed: inner.points_analysed || 0,
    radius: inner.radius ? parseFloat(inner.radius) : undefined,
    averagePrice: inner.average ?? null,
    transactionCount: rawData.length,
    status: raw.status || "success",
    data: rawData.map((entry: any) => ({
      address: entry.address || "",
      price: entry.price || 0,
      date: entry.date || "",
      type: entry.type || "",
      tenure: entry.tenure || "",
      newBuild: entry.class === "new_build",
      distance: typeof entry.distance === "string" ? parseFloat(entry.distance) : (entry.distance || 0),
    })),
  };
}

// ─── Sold Prices Per Sqft ───────────────────────────────────────────────────

export interface SoldPricesPerSqftOptions {
  type?: string;
  tenure?: string;
  maxAge?: number;
  minSqf?: number;
  maxSqf?: number;
}

export async function getSoldPricesPerSqft(
  postcode: string,
  options: SoldPricesPerSqftOptions = {},
): Promise<PropertyDataSoldPricesPerSqft> {
  const raw = await fetchRaw("sold-prices-per-sqf", {
    postcode,
    type: options.type,
    tenure: options.tenure,
    max_age: options.maxAge,
    min_sqf: options.minSqf,
    max_sqf: options.maxSqf,
  });

  // Actual API shape: { status, postcode, data: { points_analysed, radius, average, raw_data: [...] } }
  const inner = raw.data || {};
  const rawData = Array.isArray(inner.raw_data) ? inner.raw_data : [];

  return {
    postcode: raw.postcode || postcode,
    pointsAnalysed: inner.points_analysed || 0,
    averagePricePerSqft: inner.average || 0,
    status: raw.status || "success",
    data: rawData.map((entry: any) => ({
      address: entry.address || "",
      price: entry.price || 0,
      date: entry.date || "",
      sqft: entry.sqf || 0,
      pricePerSqft: entry.price_per_sqf || 0,
      type: entry.type || "",
      tenure: entry.tenure || "",
      distance: typeof entry.distance === "string" ? parseFloat(entry.distance) : (entry.distance || 0),
    })),
  };
}

// ─── Valuation ──────────────────────────────────────────────────────────────

export interface ValuationParams {
  postcode: string;
  propertyType: string;
  constructionDate: string;
  internalArea: number;
  bedrooms: number;
  bathrooms: number;
  finishQuality: string;
  outdoorSpace: string;
  offStreetParking: number;
}

export async function getValuation(
  params: ValuationParams,
): Promise<PropertyDataValuation> {
  const raw = await fetchRaw("valuation-sale", {
    postcode: params.postcode,
    property_type: params.propertyType,
    construction_date: params.constructionDate,
    internal_area: params.internalArea,
    bedrooms: params.bedrooms,
    bathrooms: params.bathrooms,
    finish_quality: params.finishQuality,
    outdoor_space: params.outdoorSpace,
    off_street_parking: params.offStreetParking,
  });

  // Actual API shape: { status, postcode, result: { estimate, margin, confidence } }
  const result = raw.result || {};
  const estimate = result.estimate || 0;
  const margin = result.margin || 0;

  return {
    postcode: raw.postcode || params.postcode,
    result: estimate,
    resultFormatted: `£${estimate.toLocaleString()}`,
    upperRange: estimate + margin,
    lowerRange: estimate - margin,
    confidenceLevel: result.confidence || "unknown",
    pricePerSqft: params.internalArea > 0 ? Math.round(estimate / params.internalArea) : 0,
    status: raw.status || "success",
  };
}
