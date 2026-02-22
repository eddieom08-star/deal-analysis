import { callClaude, extractJson } from "./claude-client";
import type {
  PropertyListing,
  ComparableEvidence,
  InvestmentMemoData,
  EnrichedComparable,
} from "@/lib/types";
import { formatLRAddress } from "@/lib/apis/land-registry";
import { format } from "date-fns";
import { sanitizeInvestmentMemo } from "@/lib/pdf/sanitize";

const SYSTEM_PROMPT = `You are an experienced Property Transactions Advisor with expertise in UK freehold restructuring, title engineering, and portfolio optimisation strategies. You specialise in helping small portfolio investors (2-20 properties) navigate title splitting transactions for BTL portfolios, HMOs, and mixed residential holdings.

EXPERTISE DOMAINS:
- HM Land Registry procedures and practice (TP1, AP1, RX1, ST1/ST2)
- SDLT optimisation and multiple dwellings relief strategies
- Financing covenant compliance and lender consent protocols
- Leasehold enfranchisement and freehold restructuring
- Portfolio exit planning and individual property sales
- Complex title defect resolution and indemnity insurance

CONTEXT:
Processing single freehold titles covering multiple properties to create individual registered titles, enabling enhanced portfolio management, flexible exit strategies, improved financing terms, and optimised tax treatment.

SUCCESS METRICS:
- Title registration completion: <8 weeks post-submission
- SDLT optimisation savings: >10% vs single transaction
- Lender consent secured: Within financing covenants
- Land Registry requisitions: Zero on first submission
- Exit premium realisation: >10% vs portfolio sale

INSTRUCTION SET:
1. EXTRACT current title structure and encumbrances
2. MAP all properties requiring individual titles
3. IDENTIFY all stakeholders requiring consent
4. CALCULATE comprehensive costs and benefits
5. ASSESS risks and develop mitigation strategies
6. DEVELOP implementation timeline with dependencies
7. PRODUCE strategy memorandum per format specified
8. RECOMMEND proceed/defer/decline with clear rationale
9. ANTICIPATE challenges and prepare contingencies
10. QUANTIFY value creation with sensitivity analysis

You MUST respond with valid JSON only. No markdown, no explanations outside the JSON.

CRITICAL RULES:
1. Every numeric value must be derived from the provided comparable evidence data. DO NOT GUESS OR INVENT NUMBERS.
2. If a value cannot be determined from the data, use null and explain in a notes field.
3. All comparable prices must cite their source ("PropertyData" or "LR+EPC").
4. Risk ratings must be one of: "L" (Low), "M" (Medium), "H" (High).
5. The Go/No-Go decision must be supported by at least 3 specific data points from the evidence.
6. Use the comparable £/sqft data to derive split valuations for individual flats.
7. Apply a 15-25% block discount when estimating the as-is whole block value.
8. Sales costs should be estimated at 2.5% of gross value.
9. SDLT must be calculated using additional property rates for England.
10. Legal fees for title splitting should be estimated at £1,500-2,500 per unit.`;

function buildUserPrompt(
  listing: PropertyListing,
  evidence: ComparableEvidence,
): string {
  const pdSold = evidence.propertyData.soldPrices;
  const pdSqft = evidence.propertyData.soldPricesPerSqft;
  const pdVal = evidence.propertyData.valuation;
  const metrics = evidence.areaMetrics;
  const xref = evidence.crossReference;

  let prompt = `Analyze this property for title splitting potential and produce a complete Investment Assessment Memo as JSON.

## PROPERTY LISTING
URL: ${listing.url}
Price: ${listing.displayPrice}
Address: ${listing.address.displayAddress}
Postcode: ${listing.address.postcode}
Type: ${listing.propertyType}
Bedrooms: ${listing.bedrooms}
Bathrooms: ${listing.bathrooms}
Tenure: ${listing.tenure || "Not stated"}
EPC Rating: ${listing.epcRating || "Not available"}
Council Tax Band: ${listing.councilTaxBand || "Not available"}
Size: ${listing.sizeSqft ? `${listing.sizeSqft} sq ft (${listing.sizeSqm} sq m)` : "Not stated"}
Estimated Number of Flats: ${listing.numberOfFlats || "Not determined from listing"}
Key Features: ${listing.keyFeatures.join("; ") || "None listed"}

## DESCRIPTION
${listing.description}

## USER NOTES
${listing.url}
`;

  // PropertyData Comparables
  if (pdSold) {
    prompt += `\n## COMPARABLE SOLD PRICES (PropertyData.co.uk)
Postcode: ${pdSold.postcode}
Points Analysed: ${pdSold.pointsAnalysed}
Average Price: £${pdSold.averagePrice?.toLocaleString()}
Transaction Count: ${pdSold.transactionCount}

| Address | Price | Date | Type | Tenure | Distance |
|---------|-------|------|------|--------|----------|
`;
    const soldData = Array.isArray(pdSold?.data) ? pdSold.data : [];
    for (const s of soldData.slice(0, 20)) {
      prompt += `| ${s.address} | £${s.price.toLocaleString()} | ${s.date} | ${s.type} | ${s.tenure} | ${s.distance}mi |\n`;
    }
  }

  // PropertyData £/sqft
  if (pdSqft) {
    prompt += `\n## SOLD PRICES PER SQFT (PropertyData.co.uk)
Average £/sqft: £${pdSqft.averagePricePerSqft}

| Address | Price | Date | Sqft | £/sqft | Type | Tenure | Distance |
|---------|-------|------|------|--------|------|--------|----------|
`;
    const sqftData = Array.isArray(pdSqft?.data) ? pdSqft.data : [];
    for (const s of sqftData.slice(0, 15)) {
      prompt += `| ${s.address} | £${s.price.toLocaleString()} | ${s.date} | ${s.sqft} | £${s.pricePerSqft} | ${s.type} | ${s.tenure} | ${s.distance}mi |\n`;
    }
  }

  // PropertyData Valuation
  if (pdVal) {
    prompt += `\n## PROPERTY VALUATION ESTIMATE (PropertyData.co.uk)
Estimated Value: ${pdVal.resultFormatted}
Range: £${pdVal.lowerRange?.toLocaleString()} - £${pdVal.upperRange?.toLocaleString()}
Confidence: ${pdVal.confidenceLevel}
£/sqft: £${pdVal.pricePerSqft}
`;
  }

  // Enriched Comparables (HouseMetric approach)
  if (evidence.enrichedComparables.length > 0) {
    prompt += `\n## ENRICHED COMPARABLES (Land Registry + EPC - Independent Calculation)
Sample Size: ${evidence.enrichedComparables.length} matched sales

| Address | Price | Date | sqm | sqft | £/sqft | £/sqm | Type | EPC | Beds | Confidence |
|---------|-------|------|-----|------|--------|-------|------|-----|------|------------|
`;
    for (const c of evidence.enrichedComparables.slice(0, 15)) {
      prompt += `| ${c.address} | £${c.salePrice.toLocaleString()} | ${c.saleDate} | ${c.floorAreaSqm} | ${c.floorAreaSqft} | £${c.pricePerSqft} | £${c.pricePerSqm} | ${c.propertyType} | ${c.epcRating} | ${c.bedrooms || "?"} | ${c.matchConfidence} |\n`;
    }
  }

  // Area metrics
  if (metrics) {
    prompt += `\n## AREA PRICE METRICS (LR+EPC Calculated)
Mean £/sqft: £${metrics.meanPricePerSqft}
Median £/sqft: £${metrics.medianPricePerSqft}
Range: £${metrics.minPricePerSqft} - £${metrics.maxPricePerSqft}/sqft
Mean £/sqm: £${metrics.meanPricePerSqm}
Median £/sqm: £${metrics.medianPricePerSqm}
Sample: ${metrics.sampleCount} sales from ${metrics.dateRange.from} to ${metrics.dateRange.to}
`;
  }

  // Cross-reference
  prompt += `\n## CROSS-REFERENCE ANALYSIS
${xref.note}
PropertyData avg £/sqft: ${xref.propertyDataAvgSqft !== null ? `£${xref.propertyDataAvgSqft}` : "N/A"}
LR+EPC avg £/sqft: ${xref.enrichedAvgSqft !== null ? `£${xref.enrichedAvgSqft}` : "N/A"}
Agreement Level: ${xref.agreement}
${xref.divergencePercent !== null ? `Divergence: ${xref.divergencePercent}%` : ""}
`;

  // Land Registry raw (for additional context)
  if (evidence.landRegistry.length > 0) {
    prompt += `\n## ADDITIONAL LAND REGISTRY TRANSACTIONS (Last 18 months)
| Address | Price | Date | Type | Tenure |
|---------|-------|------|------|--------|
`;
    for (const t of evidence.landRegistry.slice(0, 15)) {
      prompt += `| ${formatLRAddress(t.address)} | £${t.price.toLocaleString()} | ${t.date} | ${t.propertyType} | ${t.tenure === "L" ? "Leasehold" : "Freehold"} |\n`;
    }
  }

  prompt += `\n## REQUIRED OUTPUT
Produce the Investment Assessment Memo as a single JSON object matching the InvestmentMemoData interface. Include all sections:
- keyMetrics (purchasePrice, splitGDV, lenderLTV75, grossProfit, roi)
- recommendation (PROCEED, PROCEED_WITH_CONDITIONS, or REJECT)
- screening (overview, mandatoryCriteria, unitSchedule)
- financial (all costs, exit valuations, returns, stressedReturns at -10%)
- comparables (individualFlatSales from evidence, blockDiscount analysis)
- risks (matrix with L/M/H ratings, redFlags)
- implementation (exitStrategy, timeline, professionalTeam)
- goNoGo (criteria, decision, conditions)

Use today's date: ${format(new Date(), "yyyy-MM-dd")}
Property address: ${listing.address.displayAddress}`;

  return prompt;
}

export async function generateInvestmentMemo(
  listing: PropertyListing,
  evidence: ComparableEvidence,
): Promise<InvestmentMemoData> {
  const userPrompt = buildUserPrompt(listing, evidence);

  let response = await callClaude(SYSTEM_PROMPT, userPrompt, 12000);
  let json = extractJson(response);

  try {
    return sanitizeInvestmentMemo(JSON.parse(json));
  } catch (firstError) {
    // Retry with error feedback
    try {
      const retryPrompt = `${userPrompt}\n\nPREVIOUS ATTEMPT FAILED TO PARSE. Error: ${firstError}. The response must be valid JSON only, no markdown wrapping. Start with { and end with }.`;
      response = await callClaude(SYSTEM_PROMPT, retryPrompt, 12000);
      json = extractJson(response);
      return sanitizeInvestmentMemo(JSON.parse(json));
    } catch (retryError) {
      throw new Error(
        `Claude JSON parse failed after retry: ${retryError instanceof Error ? retryError.message : 'Unknown'}`,
      );
    }
  }
}
