import { callClaude, extractJson } from "./claude-client";
import type {
  PropertyListing,
  ComparableEvidence,
  ValuationMemoData,
} from "@/lib/types";
import { formatLRAddress } from "@/lib/apis/land-registry";
import { format } from "date-fns";
import { sanitizeValuationMemo } from "@/lib/pdf/sanitize";

const SYSTEM_PROMPT = `You are a RICS-qualified property valuation specialist preparing a VALUATION MEMORANDUM for a UK property title split.

This memo supports a formal RICS Red Book valuation instruction. It must be evidence-based, conservative, and professionally structured.

YOUR OUTPUT MUST BE A SINGLE JSON OBJECT matching the ValuationMemoData interface exactly. No markdown, no commentary.

CRITICAL RULES:

1. TWO VALUATIONS REQUIRED:
   - Market Value As Is (freehold block as single investment)
   - Aggregate Value (individual long leasehold units, 999-year leases, share of freehold)
   Show the uplift clearly: uplift = aggregate - as-is.

2. CONSERVATIVE APPROACH: Your adopted £/sqm rates should sit BELOW the local market median. Explain why with specific discount reasons (condition, heating type, floor level, conversion vs purpose-built, etc.).

3. MARKET RATE SUMMARY: Include Housemetric-style statistical baseline with lower quartile, median, upper quartile £/sqm from the data provided. Show how your adopted average compares (e.g. "-54% vs median = CONSERVATIVE").

4. UNIT-BY-UNIT RATIONALE: For each flat, provide a detailed narrative explaining how you arrived at the value, citing specific comparable evidence.

5. COMPARABLE ANALYSIS: For each comparable, provide a narrative paragraph explaining its relevance and how it supports or adjusts your adopted rates.

6. STREET-LEVEL DATA: Include a table showing average £/sqm for nearby streets with sample sizes.

7. COMPARABLE EVIDENCE CONCLUSION: A summary paragraph confirming the evidence supports your adopted valuations.

8. VERIFIED UNIT SCHEDULE: Include the full unit schedule with EPC-verified floor areas in Section D, plus a minimum size compliance statement.

9. LEASE PLAN REQUIREMENTS: Bullet list of what RICS-compliant lease plans must show.

10. BRIDGE FINANCE: Include bridge lender requirements (Day 1 LTV, Exit LTV, target LTV %).

11. NEXT STEPS: Numbered list of recommended next actions.

12. VALUATION SUMMARY REPEAT: At the end, repeat the key valuation figures in a summary.

13. All comparable evidence must be within 0.5 miles, sold within 18 months (prefer 12 months).

14. £/sqm calculations must use EPC floor areas where available.

15. Cite the source for each piece of evidence ("PropertyData", "LR+EPC", "HM Land Registry").

16. If evidence is insufficient, state "INSUFFICIENT DATA" and explain what's needed.`;

function buildUserPrompt(
  listing: PropertyListing,
  evidence: ComparableEvidence,
): string {
  const pdSqft = evidence.propertyData.soldPricesPerSqft;
  const pdVal = evidence.propertyData.valuation;
  const metrics = evidence.areaMetrics;
  const xref = evidence.crossReference;

  let prompt = `Create a Valuation Memo for this property title split as JSON.

## PROPERTY LISTING
Address: ${listing.address.displayAddress}
Postcode: ${listing.address.postcode}
Listing Price: ${listing.displayPrice}
Type: ${listing.propertyType}
Bedrooms: ${listing.bedrooms}
Bathrooms: ${listing.bathrooms}
Tenure: ${listing.tenure || "Not stated"}
Size: ${listing.sizeSqft ? `${listing.sizeSqft} sq ft (${listing.sizeSqm} sq m)` : "Not stated"}
EPC Rating: ${listing.epcRating || "Not available"}
Estimated Flats: ${listing.numberOfFlats || "Not determined"}
Floorplans Available: ${listing.floorplans.length > 0 ? `Yes (${listing.floorplans.length})` : "No"}
Key Features: ${listing.keyFeatures.join("; ") || "None"}

## DESCRIPTION
${listing.description}
`;

  // PropertyData £/sqft
  if (pdSqft) {
    prompt += `\n## SOLD PRICES PER SQFT (PropertyData.co.uk)
Average £/sqft: £${pdSqft.averagePricePerSqft}

| Address | Price | Date | Sqft | £/sqft | Type | Distance |
|---------|-------|------|------|--------|------|----------|
`;
    const sqftData = Array.isArray(pdSqft?.data) ? pdSqft.data : [];
    for (const s of sqftData.slice(0, 15)) {
      prompt += `| ${s.address} | £${s.price.toLocaleString()} | ${s.date} | ${s.sqft} | £${s.pricePerSqft} | ${s.type} | ${s.distance}mi |\n`;
    }
  }

  // PropertyData Valuation
  if (pdVal) {
    prompt += `\n## AVM ESTIMATE (PropertyData.co.uk)
Value: ${pdVal.resultFormatted} (Range: £${pdVal.lowerRange?.toLocaleString()} - £${pdVal.upperRange?.toLocaleString()})
Confidence: ${pdVal.confidenceLevel}
£/sqft: £${pdVal.pricePerSqft}
`;
  }

  // Enriched Comparables
  if (evidence.enrichedComparables.length > 0) {
    prompt += `\n## ENRICHED COMPARABLES (Land Registry + EPC)
| Address | Price | Date | sqm | sqft | £/sqft | £/sqm | Type | EPC | Beds |
|---------|-------|------|-----|------|--------|-------|------|-----|------|
`;
    for (const c of evidence.enrichedComparables.slice(0, 15)) {
      prompt += `| ${c.address} | £${c.salePrice.toLocaleString()} | ${c.saleDate} | ${c.floorAreaSqm} | ${c.floorAreaSqft} | £${c.pricePerSqft} | £${c.pricePerSqm} | ${c.propertyType} | ${c.epcRating} | ${c.bedrooms || "?"} |\n`;
    }
  }

  // Area metrics
  if (metrics) {
    prompt += `\n## AREA PRICE METRICS
Mean £/sqft: £${metrics.meanPricePerSqft} | Median: £${metrics.medianPricePerSqft}
Range: £${metrics.minPricePerSqft} - £${metrics.maxPricePerSqft}/sqft
Mean £/sqm: £${metrics.meanPricePerSqm} | Median: £${metrics.medianPricePerSqm}
Sample: ${metrics.sampleCount} sales (${metrics.dateRange.from} to ${metrics.dateRange.to})
`;
  }

  // Cross-reference
  prompt += `\n## CROSS-REFERENCE
${xref.note}
Agreement: ${xref.agreement}
`;

  // Floorplan URLs
  if (listing.floorplans.length > 0) {
    prompt += `\n## FLOORPLAN URLS\n`;
    for (const fp of listing.floorplans) {
      prompt += `- ${fp.url}\n`;
    }
  }

  // Land Registry raw
  if (evidence.landRegistry.length > 0) {
    prompt += `\n## ADDITIONAL LAND REGISTRY TRANSACTIONS
| Address | Price | Date | Type | Tenure |
|---------|-------|------|------|--------|
`;
    for (const t of evidence.landRegistry.slice(0, 15)) {
      prompt += `| ${formatLRAddress(t.address)} | £${t.price.toLocaleString()} | ${t.date} | ${t.propertyType} | ${t.tenure === "L" ? "Leasehold" : "Freehold"} |\n`;
    }
  }

  prompt += `\n## REQUIRED OUTPUT
Produce the Valuation Memo as a single JSON object with these exact fields:

{
  "propertyAddress": "full address",
  "propertyName": "building name if applicable, else empty string",
  "propertySubtitle": "e.g. Freehold Block of 6 Self-Contained Flats",
  "analysisDate": "${format(new Date(), "yyyy-MM-dd")}",
  "headlineValuation": {
    "asIsFreehold": number,
    "aggregateSplitValue": number,
    "uplift": number,
    "upliftPercent": number,
    "valuationBasis": "narrative explaining Market Value As Is basis",
    "aggregateValueBasis": "narrative explaining Aggregate Value (Special Assumption) basis",
    "valuationDateContext": {
      "valuationDate": "date string",
      "day90Value": "range string or null",
      "day180Value": "range string or null",
      "marketEvidencePeriod": "e.g. 24 months to January 2026",
      "transactionSampleSize": "e.g. 278 sales in SN15 1 postcode sector"
    },
    "propertySummary": {
      "address", "propertyType", "tenure", "numberOfUnits", "totalFloorArea",
      "construction", "heating", "epcRatings", "condition", "parking", "gardens"
    }
  },
  "valuationLogic": {
    "introText": "narrative about valuation methodology",
    "marketRateSummary": {
      "source": "e.g. Housemetric.co.uk",
      "sampleDescription": "e.g. 278 residential transactions over 24 months",
      "lowerQuartile": { "priceSqm": number, "priceSqft": number },
      "median": { "priceSqm": number, "priceSqft": number },
      "upperQuartile": { "priceSqm": number, "priceSqft": number },
      "adoptedAverage": { "priceSqm": number, "priceSqft": number },
      "adoptedVsMedian": "e.g. -54%",
      "adoptedVsMedianLabel": "CONSERVATIVE",
      "discountReasons": ["reason 1", "reason 2", ...]
    },
    "perFlatValuations": [{ "flat", "floor", "beds", "giaSqm", "estimatedValue", "priceSqm" }],
    "totalAggregateValue": number,
    "unitRationale": [{ "flat", "value", "rationale": "detailed narrative citing specific comparables" }]
  },
  "comparableEvidence": {
    "introText": "narrative about comparable selection criteria",
    "comparables": [{ "address", "beds", "sqm", "price", "pricePerSqm", "date", "condition", "source" }],
    "comparableAnalysis": [{ "address", "narrative": "detailed paragraph about this comparable" }],
    "streetLevelData": [{ "street", "averagePriceSqm", "sampleSize" }],
    "adoptedAverageForComparison": number,
    "conclusion": "paragraph confirming evidence supports adopted valuations"
  },
  "propertyLayout": {
    "description": "narrative about property layout",
    "unitScheduleVerified": [{ "flat", "floor", "beds", "giaSqm", "giaSqft", "epcRating" }],
    "minimumSizeCompliance": "bold statement about all units meeting 30 sqm threshold",
    "leasePlanRequirements": ["bullet 1", "bullet 2", ...],
    "planningPortalNote": "recommendation to check planning portal"
  },
  "demisedAreas": {
    "parkingSpaces": [{ "space", "allocatedTo", "estimatedValueAdd": "range string" }],
    "parkingNote": "narrative about parking value",
    "gardens": [{ "area", "allocatedTo", "estimatedValueAdd": "range string" }],
    "gardenRecommendation": "recommendation about garden allocation",
    "commonParts": ["bullet list of common parts"],
    "freeholdCompanyStructure": "narrative about SoF company setup"
  },
  "processNotes": {
    "valuationAssumptions": ["assumption 1", "assumption 2", ...],
    "specialAssumption": "narrative",
    "reinstatementCostNote": "narrative with indicative range",
    "bridgeFinanceRequirements": ["Day 1 LTV: ...", "Exit LTV: ...", ...],
    "nextSteps": [{ "step": 1, "description": "..." }, ...],
    "valuationSummaryRepeat": {
      "asIsValue", "aggregateValue", "uplift", "upliftPercent",
      "conservativeNote": "narrative about conservative approach"
    },
    "dataSources": "e.g. HM Land Registry, EPC Register, Housemetric.co.uk, Rightmove",
    "disclaimer": "This memo is for internal use and to support formal valuation instruction"
  }
}

Property address: ${listing.address.displayAddress}`;

  return prompt;
}

export async function generateValuationMemo(
  listing: PropertyListing,
  evidence: ComparableEvidence,
): Promise<ValuationMemoData> {
  const userPrompt = buildUserPrompt(listing, evidence);

  let response = await callClaude(SYSTEM_PROMPT, userPrompt, 14000);
  let json = extractJson(response);

  try {
    return sanitizeValuationMemo(JSON.parse(json));
  } catch (firstError) {
    try {
      const retryPrompt = `${userPrompt}\n\nPREVIOUS ATTEMPT FAILED TO PARSE. Error: ${firstError}. The response must be valid JSON only. Start with { and end with }.`;
      response = await callClaude(SYSTEM_PROMPT, retryPrompt, 14000);
      json = extractJson(response);
      return sanitizeValuationMemo(JSON.parse(json));
    } catch (retryError) {
      throw new Error(
        `Claude JSON parse failed after retry: ${retryError instanceof Error ? retryError.message : 'Unknown'}`,
      );
    }
  }
}
