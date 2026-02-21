import type { LandRegistryTransaction } from "@/lib/types";

const BASE_URL = "https://landregistry.data.gov.uk/data/ppi";

interface LRJsonLdResult {
  result: {
    items: Array<Record<string, unknown>>;
  };
}

function safeStr(val: unknown): string {
  if (typeof val === "string") return val;
  return "";
}

function parsePropertyType(uri: string): LandRegistryTransaction["propertyType"] {
  if (uri.includes("detached")) return "D";
  if (uri.includes("semi-detached")) return "S";
  if (uri.includes("terraced")) return "T";
  if (uri.includes("flat")) return "F";
  return "O";
}

function parseTenure(uri: string): LandRegistryTransaction["tenure"] {
  if (uri.includes("leasehold")) return "L";
  return "F";
}

function parseRecordStatus(uri: string): LandRegistryTransaction["recordStatus"] {
  if (uri.includes("additional")) return "B";
  return "A";
}

function parseTransaction(item: Record<string, unknown>): LandRegistryTransaction {
  const addr = (item.propertyAddress as Record<string, unknown>) || {};

  return {
    transactionId: safeStr(item.transactionId || item["@id"]),
    price: typeof item.pricePaid === "number" ? item.pricePaid : 0,
    date: safeStr(item.transactionDate),
    address: {
      paon: safeStr(addr.paon),
      saon: safeStr(addr.saon),
      street: safeStr(addr.street),
      locality: safeStr(addr.locality),
      town: safeStr(addr.town),
      district: safeStr(addr.district),
      county: safeStr(addr.county),
      postcode: safeStr(addr.postcode),
    },
    propertyType: parsePropertyType(safeStr(item.propertyType)),
    newBuild: item.newBuild === true || safeStr(item.newBuild).includes("true"),
    tenure: parseTenure(safeStr(item.estateType)),
    recordStatus: parseRecordStatus(safeStr(item.recordStatus)),
  };
}

export async function getTransactionsByPostcode(
  postcode: string,
  options: { maxAgeMonths?: number; propertyType?: string } = {},
): Promise<LandRegistryTransaction[]> {
  const cleanPostcode = postcode.replace(/\s+/g, "+");
  const url = `${BASE_URL}/transaction-record.json?propertyAddress.postcode=${cleanPostcode}&_pageSize=100&_sort=-transactionDate`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000), // 15-second timeout
  });

  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`Land Registry API returned ${response.status}`);
  }

  let data: LRJsonLdResult;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`Failed to parse JSON from Land Registry API: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  const items = data?.result?.items || [];

  let transactions = items.map(parseTransaction);

  // Filter to standard transactions only
  transactions = transactions.filter((t) => t.recordStatus === "A");

  // Filter by age
  const maxAge = options.maxAgeMonths || 18;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - maxAge);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  transactions = transactions.filter((t) => t.date >= cutoffStr);

  // Filter by property type
  if (options.propertyType === "flat") {
    transactions = transactions.filter((t) => t.propertyType === "F");
  }

  return transactions;
}

export function formatLRAddress(addr: LandRegistryTransaction["address"]): string {
  const parts = [addr.saon, addr.paon, addr.street, addr.locality, addr.town]
    .filter(Boolean);
  return parts.join(", ");
}
