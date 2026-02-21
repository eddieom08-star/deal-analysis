import type { EPCCertificate } from "@/lib/types";

const BASE_URL = "https://epc.opendatacommunities.org/api/v1/domestic/search";

function getAuthHeader(): string {
  const key = process.env.EPC_API_KEY;
  if (!key) throw new Error("EPC_API_KEY not configured (format: email:apikey)");
  return `Basic ${Buffer.from(key).toString("base64")}`;
}

interface EPCApiResponse {
  rows: Array<Record<string, string>>;
  "column-names": string[];
}

function parseEpcRow(row: Record<string, string>): EPCCertificate {
  return {
    lmkKey: row["lmk-key"] || "",
    address1: row["address1"] || "",
    address2: row["address2"] || "",
    address3: row["address3"] || "",
    postcode: row["postcode"] || "",
    buildingReference: row["building-reference-number"] || "",
    currentEnergyRating: row["current-energy-rating"] || "",
    currentEnergyEfficiency: parseInt(row["current-energy-efficiency"] || "0", 10),
    potentialEnergyRating: row["potential-energy-rating"] || "",
    propertyType: row["property-type"] || "",
    builtForm: row["built-form"] || "",
    inspectionDate: row["inspection-date"] || "",
    lodgementDate: row["lodgement-date"] || "",
    totalFloorArea: parseFloat(row["total-floor-area"] || "0"),
    numberHabitableRooms: parseInt(row["number-habitable-rooms"] || "0", 10),
    floorLevel: row["floor-level"] || "",
    tenure: row["tenure"] || "",
    transactionType: row["transaction-type"] || "",
  };
}

export async function searchByPostcode(
  postcode: string,
  options: { size?: number } = {},
): Promise<EPCCertificate[]> {
  const params = new URLSearchParams({
    postcode: postcode.replace(/\s+/g, ""),
    size: String(options.size || 100),
  });

  const response = await fetch(`${BASE_URL}?${params}`, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 404) return [];
    if (response.status === 401) {
      throw new Error("EPC API authentication failed. Check EPC_API_KEY format (email:apikey)");
    }
    throw new Error(`EPC API returned ${response.status}`);
  }

  const data: EPCApiResponse = await response.json();
  return (data.rows || []).map(parseEpcRow);
}

export async function searchByAddress(
  address: string,
  postcode: string,
): Promise<EPCCertificate[]> {
  const params = new URLSearchParams({
    address: address,
    postcode: postcode.replace(/\s+/g, ""),
    size: "10",
  });

  const response = await fetch(`${BASE_URL}?${params}`, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`EPC API returned ${response.status}`);
  }

  const data: EPCApiResponse = await response.json();
  return (data.rows || []).map(parseEpcRow);
}

export function formatEpcAddress(epc: EPCCertificate): string {
  return [epc.address1, epc.address2, epc.address3].filter(Boolean).join(", ");
}

export function sqmToSqft(sqm: number): number {
  return Math.round(sqm * 10.7639);
}

export function sqftToSqm(sqft: number): number {
  return Math.round(sqft * 0.092903 * 100) / 100;
}
