import type { LandRegistryTransaction, EPCCertificate } from "@/lib/types";
import { formatLRAddress } from "@/lib/apis/land-registry";
import { formatEpcAddress } from "@/lib/apis/epc";

export interface AddressMatch {
  transaction: LandRegistryTransaction;
  epc: EPCCertificate;
  confidence: "high" | "medium" | "low";
}

function normalize(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/\b(flat|unit|apartment|apt)\b/gi, "")
    .replace(/\b(road|rd)\b/gi, "road")
    .replace(/\b(street|st)\b/gi, "street")
    .replace(/\b(avenue|ave)\b/gi, "avenue")
    .replace(/\b(drive|dr)\b/gi, "drive")
    .replace(/\b(lane|ln)\b/gi, "lane")
    .replace(/\b(close|cl)\b/gi, "close")
    .replace(/\b(crescent|cres)\b/gi, "crescent")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNumber(addr: string): string | null {
  const match = addr.match(/\b(\d+[a-z]?)\b/i);
  return match ? match[1].toLowerCase() : null;
}

function extractStreet(addr: string): string {
  // Remove leading numbers and flat references
  return addr
    .replace(/^\d+[a-z]?\s*/i, "")
    .replace(/^(flat|unit|apartment|apt)\s+\S+\s*/i, "")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[b.length][a.length];
}

function matchScore(
  tx: LandRegistryTransaction,
  epc: EPCCertificate,
): { score: number; confidence: "high" | "medium" | "low" } {
  // Postcodes must match
  const txPostcode = tx.address.postcode.replace(/\s+/g, "").toLowerCase();
  const epcPostcode = epc.postcode.replace(/\s+/g, "").toLowerCase();
  if (txPostcode !== epcPostcode) {
    return { score: 0, confidence: "low" };
  }

  const txAddr = normalize(
    `${tx.address.saon} ${tx.address.paon} ${tx.address.street}`,
  );
  const epcAddr = normalize(`${epc.address1} ${epc.address2}`);

  // Check house/flat number
  const txNum = extractNumber(txAddr);
  const epcNum = extractNumber(epcAddr);
  const numberMatch = txNum && epcNum && txNum === epcNum;

  // Check street similarity
  const txStreet = normalize(extractStreet(txAddr));
  const epcStreet = normalize(extractStreet(epcAddr));
  const streetDist = levenshtein(txStreet, epcStreet);
  const maxLen = Math.max(txStreet.length, epcStreet.length, 1);
  const streetSimilarity = 1 - streetDist / maxLen;

  // PAON/SAON matching for flats
  const txSaon = normalize(tx.address.saon);
  const epcFlatRef = normalize(epc.address1);
  const saonMatch =
    txSaon.length > 0 && epcFlatRef.length > 0 && txSaon === epcFlatRef;

  let score = 0;
  if (numberMatch) score += 40;
  if (streetSimilarity > 0.8) score += 40;
  else if (streetSimilarity > 0.6) score += 20;
  if (saonMatch) score += 20;

  let confidence: "high" | "medium" | "low" = "low";
  if (score >= 70) confidence = "high";
  else if (score >= 40) confidence = "medium";

  return { score, confidence };
}

export function matchTransactionsToEpc(
  transactions: LandRegistryTransaction[],
  certificates: EPCCertificate[],
): AddressMatch[] {
  const matches: AddressMatch[] = [];
  const usedEpcKeys = new Set<string>();

  // Sort transactions by date (newest first) for relevance
  const sortedTx = [...transactions].sort(
    (a, b) => b.date.localeCompare(a.date),
  );

  for (const tx of sortedTx) {
    let bestMatch: { epc: EPCCertificate; score: number; confidence: "high" | "medium" | "low" } | null = null;

    for (const epc of certificates) {
      if (usedEpcKeys.has(epc.lmkKey)) continue;
      if (epc.totalFloorArea <= 0) continue;

      const { score, confidence } = matchScore(tx, epc);

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { epc, score, confidence };
      }
    }

    if (bestMatch && bestMatch.score >= 40) {
      matches.push({
        transaction: tx,
        epc: bestMatch.epc,
        confidence: bestMatch.confidence,
      });
      usedEpcKeys.add(bestMatch.epc.lmkKey);
    }
  }

  return matches;
}

export function getMatchSummary(matches: AddressMatch[]): string {
  const high = matches.filter((m) => m.confidence === "high").length;
  const medium = matches.filter((m) => m.confidence === "medium").length;
  const low = matches.filter((m) => m.confidence === "low").length;
  return `${matches.length} matches (${high} high, ${medium} medium, ${low} low confidence)`;
}
