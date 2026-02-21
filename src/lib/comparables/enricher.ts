import type {
  LandRegistryTransaction,
  EPCCertificate,
  EnrichedComparable,
} from "@/lib/types";
import { matchTransactionsToEpc } from "./matcher";
import { sqmToSqft } from "@/lib/apis/epc";
import { formatLRAddress } from "@/lib/apis/land-registry";

function inferBedrooms(epc: EPCCertificate): number | null {
  const rooms = epc.numberHabitableRooms;
  if (rooms <= 0) return null;
  // Habitable rooms minus 1 (living room) gives approximate bedrooms
  return Math.max(1, rooms - 1);
}

function mapPropertyType(lr: LandRegistryTransaction, epc: EPCCertificate): string {
  if (epc.propertyType) return epc.propertyType;
  const typeMap: Record<string, string> = {
    D: "Detached",
    S: "Semi-Detached",
    T: "Terraced",
    F: "Flat",
    O: "Other",
  };
  return typeMap[lr.propertyType] || "Unknown";
}

export function enrichComparables(
  transactions: LandRegistryTransaction[],
  certificates: EPCCertificate[],
): EnrichedComparable[] {
  const matches = matchTransactionsToEpc(transactions, certificates);

  return matches
    .filter((m) => m.epc.totalFloorArea > 0 && m.transaction.price > 0)
    .map((m) => {
      const sqm = m.epc.totalFloorArea;
      const sqft = sqmToSqft(sqm);

      return {
        address: formatLRAddress(m.transaction.address),
        salePrice: m.transaction.price,
        saleDate: m.transaction.date,
        floorAreaSqm: sqm,
        floorAreaSqft: sqft,
        pricePerSqm: Math.round(m.transaction.price / sqm),
        pricePerSqft: Math.round(m.transaction.price / sqft),
        propertyType: mapPropertyType(m.transaction, m.epc),
        tenure: m.transaction.tenure === "L" ? "Leasehold" : "Freehold",
        epcRating: m.epc.currentEnergyRating,
        bedrooms: inferBedrooms(m.epc),
        matchConfidence: m.confidence,
        source: "land-registry+epc" as const,
      };
    })
    .sort((a, b) => b.saleDate.localeCompare(a.saleDate));
}
