import * as cheerio from "cheerio";
import type { PropertyListing, PropertyAddress } from "@/lib/types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const RIGHTMOVE_URL_PATTERN = /rightmove\.co\.uk\/properties\/(\d+)/;
const POSTCODE_PATTERN = /([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})/i;
const PAGE_MODEL_PATTERN = /window\.PAGE_MODEL\s*=\s*(\{[\s\S]*?\})\s*$/m;

export class ScrapingError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "ScrapingError";
  }
}

function extractPageModel(html: string): Record<string, unknown> {
  const $ = cheerio.load(html);
  let pageModel: Record<string, unknown> | null = null;

  $("script").each((_, el) => {
    const text = $(el).text();
    if (text.includes("PAGE_MODEL")) {
      const match = text.match(PAGE_MODEL_PATTERN);
      if (match?.[1]) {
        try {
          pageModel = JSON.parse(match[1]);
        } catch {
          // Try a more permissive extraction
          const start = text.indexOf("PAGE_MODEL") + "PAGE_MODEL".length;
          const eqIdx = text.indexOf("=", start);
          if (eqIdx !== -1) {
            const jsonStr = text.slice(eqIdx + 1).trim().replace(/;$/, "");
            try {
              pageModel = JSON.parse(jsonStr);
            } catch {
              // Extraction failed
            }
          }
        }
      }
    }
  });

  if (!pageModel) {
    throw new ScrapingError("PAGE_MODEL not found in listing HTML");
  }

  return pageModel;
}

function parseAddress(data: Record<string, unknown>): PropertyAddress {
  const addr = data as Record<string, string>;
  const displayAddress = addr.displayAddress || "";
  const outcode = addr.outcode || "";
  const incode = addr.incode || "";
  const postcode = outcode && incode ? `${outcode} ${incode}` : "";

  // Extract street from display address (first line before comma)
  let street = displayAddress.split(",")[0]?.trim() || "";
  // Remove flat/unit numbers from street for folder naming
  street = street.replace(/^(Flat|Unit|Apartment)\s+\S+\s*/i, "").trim();

  // If no postcode from structured data, try regex on display address
  const finalPostcode =
    postcode || displayAddress.match(POSTCODE_PATTERN)?.[1] || "";

  return {
    displayAddress,
    postcode: finalPostcode,
    outcode,
    incode,
    street,
  };
}

function safeGet(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function safeNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const parsed = parseFloat(val.replace(/[£,]/g, ""));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function safeString(val: unknown): string {
  if (typeof val === "string") return val;
  return "";
}

function parsePrice(data: Record<string, unknown>): {
  price: number;
  displayPrice: string;
} {
  const prices = data.prices as Record<string, unknown> | undefined;
  const primaryPrice = safeString(prices?.primaryPrice);
  const price = safeNumber(primaryPrice);
  return { price, displayPrice: primaryPrice || `£${price.toLocaleString()}` };
}

function inferNumberOfFlats(description: string, keyFeatures: string[]): number | null {
  const allText = [description, ...keyFeatures].join(" ").toLowerCase();

  // Look for patterns like "4 flats", "block of 6", "3 self-contained"
  const patterns = [
    /(\d+)\s*(?:self[- ]?contained\s+)?(?:flats?|apartments?|units?)/i,
    /block\s+of\s+(\d+)/i,
    /comprising\s+(\d+)/i,
    /converted\s+into\s+(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = allText.match(pattern);
    if (match?.[1]) {
      const num = parseInt(match[1], 10);
      if (num >= 2 && num <= 30) return num;
    }
  }

  return null;
}

export async function scrapeRightmoveListing(
  url: string,
): Promise<PropertyListing> {
  const urlMatch = url.match(RIGHTMOVE_URL_PATTERN);
  if (!urlMatch) {
    throw new ScrapingError(
      "Invalid Rightmove URL. Expected format: rightmove.co.uk/properties/NNNNN",
    );
  }
  const listingId = urlMatch[1];

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-GB,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new ScrapingError(
      `Rightmove returned ${response.status}`,
      response.status,
    );
  }

  const html = await response.text();
  const pageModel = extractPageModel(html);
  const propertyData = pageModel.propertyData as Record<string, unknown>;

  if (!propertyData) {
    throw new ScrapingError("propertyData not found in PAGE_MODEL");
  }

  const addressData = propertyData.address as Record<string, unknown>;
  const address = parseAddress(addressData || {});
  const { price, displayPrice } = parsePrice(propertyData);

  const description = safeString(
    safeGet(propertyData, "text.description"),
  );
  const keyFeatures = (
    (propertyData.keyFeatures as string[]) || []
  ).filter(Boolean);

  const images = (
    (propertyData.images as Array<Record<string, unknown>>) || []
  ).map((img) => ({
    url: safeString(img.url || img.srcUrl),
    caption: safeString(img.caption),
  }));

  const floorplans = (
    (propertyData.floorplans as Array<Record<string, unknown>>) || []
  ).map((fp) => ({
    url: safeString(fp.url || fp.srcUrl),
    caption: safeString(fp.caption),
  }));

  const location = propertyData.location as Record<string, unknown>;

  const sizingData = propertyData.sizings as Array<Record<string, unknown>> | undefined;
  let sizeSqft: number | null = null;
  let sizeSqm: number | null = null;
  if (sizingData && sizingData.length > 0) {
    const sizing = sizingData[0];
    if (sizing.minimumSize || sizing.maximumSize) {
      const minSize = safeNumber(sizing.minimumSize);
      const maxSize = safeNumber(sizing.maximumSize);
      const unit = safeString(sizing.unit);
      const avgSize = maxSize > 0 ? (minSize + maxSize) / 2 : minSize;
      if (unit.toLowerCase().includes("sqft") || unit.toLowerCase().includes("sq ft")) {
        sizeSqft = avgSize;
        sizeSqm = Math.round(avgSize * 0.092903);
      } else if (unit.toLowerCase().includes("sqm") || unit.toLowerCase().includes("sq m")) {
        sizeSqm = avgSize;
        sizeSqft = Math.round(avgSize * 10.7639);
      }
    }
  }

  return {
    id: listingId,
    url,
    price,
    displayPrice,
    address,
    propertyType: safeString(propertyData.propertySubType || propertyData.propertyType),
    propertySubType: safeString(propertyData.propertySubType),
    bedrooms: safeNumber(propertyData.bedrooms),
    bathrooms: safeNumber(propertyData.bathrooms),
    tenure: safeString(
      safeGet(propertyData, "tenure.tenureType"),
    ),
    description,
    keyFeatures,
    images,
    floorplans,
    epcRating: safeString(safeGet(propertyData, "epc.currentEnergyRating")) || null,
    councilTaxBand: safeString(safeGet(propertyData, "councilTaxBand")) || null,
    latitude: safeNumber(location?.latitude),
    longitude: safeNumber(location?.longitude),
    agent: {
      name: safeString(safeGet(pageModel, "analyticsInfo.analyticsProperty.agentName")),
      branch: safeString(safeGet(pageModel, "analyticsInfo.analyticsProperty.agentBranch")),
      phone: safeString(safeGet(propertyData, "contactInfo.telephoneNumbers.localNumber")),
    },
    sizeSqft,
    sizeSqm,
    numberOfFlats: inferNumberOfFlats(description, keyFeatures),
  };
}
