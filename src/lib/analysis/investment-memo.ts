import { callClaude, extractJson } from "./claude-client";
import type {
  PropertyListing,
  ComparableEvidence,
  InvestmentMemoData,
} from "@/lib/types";
import { formatLRAddress } from "@/lib/apis/land-registry";
import { format } from "date-fns";
import { sanitizeInvestmentMemo } from "@/lib/pdf/sanitize";

const SYSTEM_PROMPT = `You are an experienced Property Transactions Advisor producing a FREEHOLD BLOCK TITLE SPLITTING INVESTMENT ASSESSMENT MEMO for a UK property.

You specialise in:
- Freehold restructuring and title splitting for blocks of flats
- SDLT/LTT optimisation and multiple dwellings relief
- Evidence-based property valuation using comparable sales data
- Financial modelling with Conservative/Moderate/Aggressive scenarios

YOUR OUTPUT MUST BE A SINGLE JSON OBJECT matching the InvestmentMemoData interface exactly. No markdown, no commentary.

CRITICAL RULES:

1. TWO VALUE CREATION STEPS - The memo MUST model two distinct steps:
   - Step 1: TITLE SPLIT (As-Is Aggregate Value) - value unlocked by splitting into individual titles in CURRENT condition
   - Step 2: POST-REFURBISHMENT GDV - enhanced values after cosmetic/light refurbishment
   Both steps must include Conservative/Moderate/Aggressive per-unit £/sqm valuations derived from comparable evidence.

2. CONSERVATIVE/MODERATE/AGGRESSIVE throughout:
   - Conservative = lower-quartile comparable evidence
   - Moderate = median comparable evidence
   - Aggressive = upper-quartile comparable evidence
   All financial returns must be modelled across all 3 scenarios.

3. EVIDENCE-BASED ONLY - Every £/sqm rate must be derivable from the provided comparable data. If data is insufficient, use the closest available evidence and note the limitation.

4. SDLT/LTT BREAKDOWN - If property is in Wales, use LTT (Land Transaction Tax) higher rates. If England, use SDLT additional property rates. Provide a full band-by-band breakdown table.

5. OUT-OF-POCKET EXPENSES - Clearly itemise all acquisition costs (stamp duty, legal fees, survey), splitting costs (lease creation, Land Registry, surveys), refurbishment costs (per unit with £/sqm rate), and finance/holding costs. Each cost item must include a notes field explaining the basis.

6. STRESS TEST at GDV -10% across all 3 scenarios.

7. MAX PURCHASE PRICE - Calculate the maximum purchase price to achieve 20% ROI under each scenario.

8. HOUSEMETRIC BASELINE - Include area statistical baseline with lower quartile, median, upper quartile £/sqm from the comparable data provided.

9. BLOCK DISCOUNT - Show discount achieved vs both as-is aggregate AND post-refurb GDV.

10. KEY METRICS must include: Purchase Price, Aggregate Value (as-is moderate), Post-Refurb GDV (moderate), Lender LTV (75%), Gross Profit (moderate), ROI (moderate).

11. Risk ratings use full words: "LOW", "MEDIUM", "HIGH", "CERTAIN" for likelihood; "LOW", "MEDIUM", "HIGH", "CRITICAL" for impact.

12. Go/No-Go criteria should include a "confidence" field per criterion.

13. Conditions in goNoGo must be an array of strings (numbered conditions).

14. Include a criticalNote field for important contextual warnings (e.g. Welsh LTT vs SDLT, estimated unit sizes, etc).

15. The screening overview fields (listingPrice, numberOfFlats, totalGia) should be descriptive strings, not raw numbers. E.g. "£485,000 (Guide Price)", "4 (2 x 2-bed, 2 x 1-bed)", "~166 sqm (~1,787 sq ft)".`;

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
Produce the Investment Assessment Memo as a single JSON object with these exact top-level fields:

{
  "propertyAddress": "full address string",
  "analysisDate": "${format(new Date(), "yyyy-MM-dd")}",
  "keyMetrics": {
    "purchasePrice": number,
    "aggregateValue": number,  // Step 1 as-is moderate total
    "postRefurbGDV": number,   // Step 2 post-refurb moderate total
    "lenderLTV75": number,     // 75% of aggregate value
    "grossProfit": number,     // moderate scenario profit
    "roi": number              // moderate scenario ROI percentage
  },
  "criticalNote": "string - important contextual warnings e.g. Welsh LTT, estimated sizes, etc.",
  "recommendation": "PROCEED" | "PROCEED_WITH_CONDITIONS" | "REJECT",
  "recommendationRationale": "detailed rationale string",
  "screening": {
    "overview": {
      "address", "listingPrice" (descriptive string), "numberOfFlats" (descriptive string),
      "totalGia" (descriptive string), "buildingType", "construction", "listedStatus",
      "tenure", "currentCondition", "vacancyStatus", "currentYield", "epcRatings",
      "councilTaxBands", "locationNotes", "agent", "listedDate"
    },
    "mandatoryCriteria": [{ "criterion", "requirement", "status": "PASS"|"FAIL"|"UNVERIFIED"|"LIKELY_PASS", "confidence": "LOW"|"MEDIUM"|"HIGH" }],
    "criticalNote": "screening-specific warnings",
    "unitSchedule": [{ "flat", "floor", "beds", "giaSqm", "giaSqft", "epc", "meetsMinSize": true/false/"CHECK"/"UNVERIFIED", "currentRent" }],
    "unitScheduleSummary": "e.g. Total flats: 4 | Flats likely >=30 sqm: 2 | Flats requiring verification: 2"
  },
  "financial": {
    "valueCreationStep1": {
      "title": "Value Creation Step 1: Title Split (As-Is Aggregate Value)",
      "description": "narrative about what this step represents",
      "perUnit": [{ "flat", "sqm", "beds", "conservativePriceSqm", "moderatePriceSqm", "aggressivePriceSqm", "asIsValue" (moderate) }],
      "totals": { "conservative", "moderate", "aggressive" },
      "blockDiscountNote": "e.g. Aggregate value at moderate: £640,000 vs purchase price £485,000 = 32.0% block discount"
    },
    "valueCreationStep2": {
      "title": "Value Creation Step 2: Post-Refurbishment GDV",
      "description": "narrative about refurb uplift expectations",
      "perUnit": [{ "flat", "sqm", "conservativeGDV", "moderateGDV", "aggressiveGDV", "priceSqmMod" }],
      "totals": { "conservative", "moderate", "aggressive" }
    },
    "acquisitionCosts": [{ "item", "amount", "notes" }],
    "totalAcquisition": number,
    "splittingCosts": [{ "item", "amount", "notes" }],
    "totalSplitting": number,
    "refurbishmentCosts": [{ "item", "amount", "notes" }],
    "totalRefurbishment": number,
    "financeCosts": [{ "item", "amount", "notes" }],
    "totalFinanceAndHolding": number,
    "totalProjectInvestment": number,
    "taxBreakdown": {
      "taxType": "SDLT" or "LTT",
      "effectiveRate": "e.g. 8.4% eff.",
      "bands": [{ "band", "rate", "taxableAmount", "taxDue", "cumulative" }],
      "totalTax": number
    },
    "scenarioReturns": {
      "conservative": { "totalGDV", "totalInvestment", "salesCosts", "netProceeds", "grossProfit", "profitMargin", "roi", "profitPerUnit", "holdPeriodMonths", "annualisedRoi" },
      "moderate": { same fields },
      "aggressive": { same fields }
    },
    "stressTest": {
      "conservative": { same ScenarioReturn fields at -10% GDV },
      "moderate": { same },
      "aggressive": { same }
    },
    "maxPurchaseForTargetROI": [{ "scenario", "gdv", "maxPurchasePrice" }],
    "maxPurchaseNote": "narrative about negotiation target"
  },
  "comparables": {
    "description": "intro text about evidence sources",
    "individualFlatSales": [{ "address", "type", "beds", "sqm", "price", "pricePerSqm", "date", "source" }],
    "comparableNote": "note about data quality (estimated vs verified sqm)",
    "housemetricBaseline": {
      "source", "sampleSize", "period",
      "lowerQuartile", "median", "upperQuartile" (all £/sqm numbers),
      "subjectStreetAvg" (number or null),
      "note": "narrative about what the baseline shows"
    },
    "blockDiscount": {
      "sumAsIsModerate", "sumPostRefurbModerate", "acquisitionPrice",
      "discountVsAsIs" (%), "discountVsPostRefurb" (%),
      "typicalRange": "15-25%",
      "note": "narrative about the discount"
    }
  },
  "risks": {
    "matrix": [{ "risk", "likelihood": "LOW"|"MEDIUM"|"HIGH"|"CERTAIN", "impact": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "mitigation" }],
    "redFlags": [{ "flag", "status": "descriptive status string" }]
  },
  "implementation": {
    "exitStrategy": "SHARE_OF_FREEHOLD" etc,
    "exitStrategyLabel": "e.g. Option B: Share of Freehold Sale (RECOMMENDED)",
    "exitStrategyRationale": "detailed rationale",
    "timeline": [{ "week", "activity", "status" }],
    "professionalTeam": [{ "role", "notes" }]
  },
  "goNoGo": {
    "criteria": [{ "requirement", "target", "status": "PASS"|"FAIL"|"UNVERIFIED"|"LIKELY" or specific value, "confidence" }],
    "decision": "PROCEED"|"PROCEED_WITH_CONDITIONS"|"REJECT",
    "conditions": ["array", "of", "condition", "strings"],
    "analystNote": "Analyst: Claude AI | Date: ... | Confidence Level: ..."
  }
}

Use today's date: ${format(new Date(), "yyyy-MM-dd")}
Property address: ${listing.address.displayAddress}`;

  return prompt;
}

export async function generateInvestmentMemo(
  listing: PropertyListing,
  evidence: ComparableEvidence,
): Promise<InvestmentMemoData> {
  const userPrompt = buildUserPrompt(listing, evidence);

  let response = await callClaude(SYSTEM_PROMPT, userPrompt, 16000);
  let json = extractJson(response);

  try {
    return sanitizeInvestmentMemo(JSON.parse(json));
  } catch (firstError) {
    // Retry with error feedback
    try {
      const retryPrompt = `${userPrompt}\n\nPREVIOUS ATTEMPT FAILED TO PARSE. Error: ${firstError}. The response must be valid JSON only, no markdown wrapping. Start with { and end with }.`;
      response = await callClaude(SYSTEM_PROMPT, retryPrompt, 16000);
      json = extractJson(response);
      return sanitizeInvestmentMemo(JSON.parse(json));
    } catch (retryError) {
      throw new Error(
        `Claude JSON parse failed after retry: ${retryError instanceof Error ? retryError.message : 'Unknown'}`,
      );
    }
  }
}
