import type {
  PropertyDataSoldPrices,
  PropertyDataSoldPricesPerSqft,
  PropertyDataValuation,
} from "@/lib/types";

const BASE_URL = "https://api.propertydata.co.uk";

function apiKey(): string {
  const key = process.env.PROPERTY_DATA_API_KEY;
  if (!key) throw new Error("PROPERTY_DATA_API_KEY not configured");
  return key;
}

async function fetchPropertyData<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set("key", apiKey());

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) {
      url.searchParams.set(k, String(v));
    }
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000), // 15-second timeout
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

  return data as T;
}

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
  return fetchPropertyData<PropertyDataSoldPrices>("sold-prices", {
    postcode,
    type: options.type,
    tenure: options.tenure,
    max_age: options.maxAge,
    bedrooms: options.bedrooms,
    points: options.points,
  });
}

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
  return fetchPropertyData<PropertyDataSoldPricesPerSqft>(
    "sold-prices-per-sqf",
    {
      postcode,
      type: options.type,
      tenure: options.tenure,
      max_age: options.maxAge,
      min_sqf: options.minSqf,
      max_sqf: options.maxSqf,
    },
  );
}

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
  return fetchPropertyData<PropertyDataValuation>("valuation-sale", {
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
}
