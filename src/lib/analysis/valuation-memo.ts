import { callClaude, extractJson } from "./claude-client";
import type {
  PropertyListing,
  ComparableEvidence,
  ValuationMemoData,
} from "@/lib/types";
import { formatLRAddress } from "@/lib/apis/land-registry";
import { format } from "date-fns";

const SYSTEM_PROMPT = `You are a RICS-qualified property valuation specialist preparing a valuation memo for a UK property title split.

Your task is to create a valuation memo with the following sections:

A. HEADLINE VALUATION & SUMMARY
Include a one-page summary:
- "As is" freehold value (what the block is worth today as a single unit)
- Aggregate / title split value: "what it's worth as X individual long-leasehold flats"
- The valuer is asked to value both:
  - Current freehold block value
  - Value "on special assumption" that it's split to long leases (e.g. 999 years)
- Show the difference between the two (i.e., the uplift) clearly
- Include market value as is, aggregate market value based on individual leasehold sales
- 180-day / 90-day values if possible

B. VALUATION LOGIC / CALCULATIONS
For each proposed flat:
- Estimated split value
- Basis (e.g. £/sq ft vs local sales)
- Any premium for parking, garden, etc.
Summary table: Flat 1 – £X, Flat 2 – £Y, etc.
Total aggregate value = sum
Show that your £/sq ft assumptions are at or below the local average.

C. LOCAL COMPARABLE EVIDENCE
3-5 comparables, ideally:
- Within about 1/4–1/2 mile radius
- Within 6-12 months if possible (up to ~18 months if stock is thin)
For each comparable:
- Address & type (e.g. 2-bed flat)
- Sale price & date
- Price per sq ft
- Any special notes (condition, parking, garden, etc.)
Show that the aggregate figure is consistent with actual sales.
Show that your proposed £/sq ft is not higher than the average.

D. PROPERTY LAYOUT / PLANS
- Note if existing plans are available from the listing
- Describe the proposed demise layout
- Reference any floorplan images

E. DEMISED AREAS THAT DRIVE VALUE
- Parking spaces: allocation and value add per flat
- Ground-floor gardens / patios: allocation and value add
- These must be visible so the valuer understands the value-add structure

F. PRACTICAL / PROCESS NOTES
- Special assumption: "as if split into long leases" (aggregate / title split / GDB)
- Bridge exit or direct-to-mortgage at 75% of the higher value
- Reinstatement cost note
- Insurance considerations

CRITICAL: DO NOT GUESS. Find evidence to support everything stated in the memo. If evidence is insufficient for a claim, state "INSUFFICIENT DATA" and explain what additional data is needed.

You MUST respond with valid JSON only. No markdown, no explanations outside the JSON.

RULES:
1. Comparable evidence must be within 1/4 - 1/2 mile radius, 6-12 months preferred (up to 18 months if thin market).
2. £/sqft calculations must use EPC floor areas where available.
3. Show that proposed £/sqft is at or below local average.
4. Aggregate value = sum of individual flat valuations.
5. Uplift = aggregate value - as-is freehold value.
6. Each comparable must include: address, type, sale price, date, price per sqft, and any special notes.
7. Cite the source for each piece of evidence ("PropertyData" or "LR+EPC").`;

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
    for (const s of pdSqft.data?.slice(0, 15) || []) {
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

  prompt += `\n## REQUIRED OUTPUT
Produce the Valuation Memo as JSON matching the ValuationMemoData interface:
- headlineValuation (asIsFreehold, aggregateSplitValue, uplift, upliftPercent, day180Value, day90Value)
- valuationLogic (perFlatValuations with sqm/sqft/pricePerSqft/estimatedValue/basis, totalAggregateValue, areaAveragePricePerSqft)
- comparableEvidence (3-5 best comparables with full details and source citation)
- propertyLayout (plans availability, proposed demise notes)
- demisedAreas (parking, gardens, value impacts)
- processNotes (special assumption, exit strategy, reinstatement, insurance)

Use today's date: ${format(new Date(), "yyyy-MM-dd")}
Property address: ${listing.address.displayAddress}`;

  return prompt;
}

export async function generateValuationMemo(
  listing: PropertyListing,
  evidence: ComparableEvidence,
): Promise<ValuationMemoData> {
  const userPrompt = buildUserPrompt(listing, evidence);

  let response = await callClaude(SYSTEM_PROMPT, userPrompt, 10000);
  let json = extractJson(response);

  try {
    return JSON.parse(json) as ValuationMemoData;
  } catch (firstError) {
    const retryPrompt = `${userPrompt}\n\nPREVIOUS ATTEMPT FAILED TO PARSE. Error: ${firstError}. The response must be valid JSON only. Start with { and end with }.`;
    response = await callClaude(SYSTEM_PROMPT, retryPrompt, 10000);
    json = extractJson(response);
    return JSON.parse(json) as ValuationMemoData;
  }
}
