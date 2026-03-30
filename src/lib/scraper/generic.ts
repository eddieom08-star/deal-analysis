import * as cheerio from "cheerio";
import type { PropertyListing, PropertyAddress } from "@/lib/types";
import { callClaude, extractJson } from "@/lib/analysis/claude-client";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const POSTCODE_PATTERN = /([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})/i;

export class ScrapingError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "ScrapingError";
  }
}

/**
 * Generic scraper that fetches any property listing page,
 * extracts the text content, and uses Claude to parse it
 * into a PropertyListing object.
 */
export async function scrapeGenericListing(url: string): Promise<PropertyListing> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-GB,en;q=0.9",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new ScrapingError(`Page returned ${response.status}`, response.status);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove noise
  $("script, style, nav, footer, header, noscript, iframe, svg").remove();

  // Extract structured data if available (JSON-LD)
  const jsonLd = extractJsonLd($);

  // Extract meaningful text content
  const title = $("title").text().trim();
  const metaDescription = $('meta[name="description"]').attr("content") || "";
  const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);

  // Extract image URLs (look for property images)
  const imageUrls: string[] = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (src && (src.includes("property") || src.includes("listing") || src.includes("photo") || src.includes("image"))) {
      imageUrls.push(src);
    }
  });

  // Try to find postcode from page content
  const allText = `${title} ${metaDescription} ${bodyText}`;
  const postcodeMatch = allText.match(POSTCODE_PATTERN);

  // Use Claude to extract structured listing data from the page content
  const listing = await extractListingWithClaude(url, title, metaDescription, bodyText, jsonLd, imageUrls, postcodeMatch?.[1] || null);

  return listing;
}

function extractJsonLd($: cheerio.CheerioAPI): Record<string, unknown> | null {
  let result: Record<string, unknown> | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      // Look for property-related schema
      if (data["@type"] === "Product" || data["@type"] === "RealEstateListing" || data["@type"] === "Place") {
        result = data;
      }
    } catch {
      // Skip malformed JSON-LD
    }
  });

  return result;
}

async function extractListingWithClaude(
  url: string,
  title: string,
  metaDescription: string,
  bodyText: string,
  jsonLd: Record<string, unknown> | null,
  imageUrls: string[],
  detectedPostcode: string | null,
): Promise<PropertyListing> {
  const systemPrompt = `You are a UK property listing data extractor. Given the text content of a property listing web page, extract structured data into a JSON object.

You MUST respond with valid JSON only. No markdown, no commentary.

Extract these fields:
{
  "price": number (numeric price in GBP, 0 if not found),
  "displayPrice": "string (formatted price as shown, e.g. '£485,000')",
  "address": {
    "displayAddress": "full address string",
    "postcode": "e.g. CF24 3AA",
    "outcode": "e.g. CF24",
    "incode": "e.g. 3AA",
    "street": "street name without flat/unit prefix"
  },
  "propertyType": "e.g. Flat, House, Block of Flats",
  "propertySubType": "more specific type",
  "bedrooms": number,
  "bathrooms": number,
  "tenure": "Freehold or Leasehold or empty string",
  "description": "full property description text",
  "keyFeatures": ["feature1", "feature2"],
  "epcRating": "A-G or null",
  "councilTaxBand": "A-H or null",
  "agent": { "name": "", "branch": "", "phone": "" },
  "sizeSqft": number or null,
  "sizeSqm": number or null,
  "numberOfFlats": number or null (infer from description if block of flats)
}

RULES:
1. Extract ALL available data from the page content
2. For prices, parse out the numeric value (remove £ and commas)
3. For postcodes, use UK format: outcode + space + incode
4. If a field cannot be determined, use sensible defaults (0 for numbers, "" for strings, null for optional)
5. The numberOfFlats should be inferred from descriptions like "block of 4 flats", "comprising 6 units", etc.`;

  const userPrompt = `Extract property listing data from this page:

URL: ${url}
Title: ${title}
Meta Description: ${metaDescription}
${detectedPostcode ? `Detected Postcode: ${detectedPostcode}` : ""}
${jsonLd ? `\nJSON-LD Data:\n${JSON.stringify(jsonLd, null, 2)}` : ""}

Page Content:
${bodyText}`;

  const response = await callClaude(systemPrompt, userPrompt, 4000);
  const json = extractJson(response);
  const data = JSON.parse(json) as Record<string, unknown>;

  // Build PropertyListing from Claude's extraction
  const addr = (data.address || {}) as Record<string, string>;
  const agent = (data.agent || {}) as Record<string, string>;
  const postcode = addr.postcode || detectedPostcode || "";
  const parts = postcode.split(/\s+/);

  return {
    id: url.split("/").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "unknown",
    url,
    price: Number(data.price) || 0,
    displayPrice: String(data.displayPrice || `£${Number(data.price || 0).toLocaleString()}`),
    address: {
      displayAddress: String(addr.displayAddress || title || ""),
      postcode,
      outcode: String(addr.outcode || parts[0] || ""),
      incode: String(addr.incode || parts[1] || ""),
      street: String(addr.street || ""),
    },
    propertyType: String(data.propertyType || ""),
    propertySubType: String(data.propertySubType || ""),
    bedrooms: Number(data.bedrooms) || 0,
    bathrooms: Number(data.bathrooms) || 0,
    tenure: String(data.tenure || ""),
    description: String(data.description || ""),
    keyFeatures: Array.isArray(data.keyFeatures) ? data.keyFeatures.map(String) : [],
    images: imageUrls.slice(0, 20).map((u) => ({ url: u, caption: "" })),
    floorplans: [],
    epcRating: data.epcRating ? String(data.epcRating) : null,
    councilTaxBand: data.councilTaxBand ? String(data.councilTaxBand) : null,
    latitude: 0,
    longitude: 0,
    agent: {
      name: String(agent.name || ""),
      branch: String(agent.branch || ""),
      phone: String(agent.phone || ""),
    },
    sizeSqft: data.sizeSqft != null ? Number(data.sizeSqft) : null,
    sizeSqm: data.sizeSqm != null ? Number(data.sizeSqm) : null,
    numberOfFlats: data.numberOfFlats != null ? Number(data.numberOfFlats) : null,
  };
}
