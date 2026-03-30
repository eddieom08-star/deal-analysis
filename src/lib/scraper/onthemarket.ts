import * as cheerio from "cheerio";
import type { PropertyListing, PropertyAddress } from "@/lib/types";
import { scrapeGenericListing, ScrapingError } from "./generic";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const POSTCODE_PATTERN = /([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})/i;

function safeString(val: unknown): string {
  if (typeof val === "string") return val;
  return "";
}

function safeNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const parsed = parseFloat(val.replace(/[£,]/g, ""));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
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

/**
 * OnTheMarket scraper.
 * OnTheMarket is a Next.js app that embeds property data in __NEXT_DATA__.
 * Falls back to generic scraper if structured data extraction fails.
 */
export async function scrapeOnTheMarketListing(url: string): Promise<PropertyListing> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-GB,en;q=0.9",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new ScrapingError(`OnTheMarket returned ${response.status}`, response.status);
  }

  const html = await response.text();

  // Try to extract __NEXT_DATA__ first (OnTheMarket is a Next.js app)
  try {
    return parseNextData(html, url);
  } catch {
    // Fall back to generic scraper
    console.log("[scraper] OnTheMarket __NEXT_DATA__ extraction failed, falling back to generic");
    return scrapeGenericListing(url);
  }
}

function parseNextData(html: string, url: string): PropertyListing {
  const $ = cheerio.load(html);
  const nextDataScript = $("#__NEXT_DATA__").text();

  if (!nextDataScript) {
    throw new Error("__NEXT_DATA__ not found");
  }

  const nextData = JSON.parse(nextDataScript);
  const pageProps = nextData?.props?.pageProps;

  if (!pageProps) {
    throw new Error("pageProps not found in __NEXT_DATA__");
  }

  // OnTheMarket stores property data in various shapes depending on the page type
  const property = pageProps.property || pageProps.listing || pageProps;

  if (!property.price && !property.displayAddress) {
    throw new Error("No property data found in pageProps");
  }

  // Extract ID from URL
  const urlParts = url.split("/");
  const id = urlParts[urlParts.length - 1]?.split("?")?.[0] || "unknown";

  // Parse address
  const displayAddress = safeString(property.displayAddress || property.address || "");
  const postcodeMatch = displayAddress.match(POSTCODE_PATTERN);
  const postcode = safeString(property.postcode || postcodeMatch?.[1] || "");
  const parts = postcode.split(/\s+/);

  // Parse price
  const priceVal = safeNumber(property.price || property.priceValue || property.displayPrice);
  const displayPrice = safeString(property.displayPrice || property.priceQualifier || `£${priceVal.toLocaleString()}`);

  // Parse images
  const rawImages = (property.images || property.media || []) as Array<Record<string, unknown>>;
  const images = rawImages
    .filter((img) => safeString(img.url || img.src || img.original))
    .map((img) => ({
      url: safeString(img.url || img.src || img.original),
      caption: safeString(img.caption || img.alt || ""),
    }));

  // Parse floorplans
  const rawFloorplans = (property.floorplans || property.floorPlans || []) as Array<Record<string, unknown>>;
  const floorplans = rawFloorplans.map((fp) => ({
    url: safeString(fp.url || fp.src || fp.original),
    caption: safeString(fp.caption || "Floorplan"),
  }));

  // Parse features
  const keyFeatures = Array.isArray(property.features || property.keyFeatures || property.bulletPoints)
    ? (property.features || property.keyFeatures || property.bulletPoints).map(String).filter(Boolean)
    : [];

  // Infer number of flats
  const description = safeString(property.description || property.fullDescription || property.summaryDescription || "");
  const numberOfFlats = inferNumberOfFlats(description, keyFeatures);

  // Size
  let sizeSqft: number | null = null;
  let sizeSqm: number | null = null;
  if (property.sizeSqFt || property.floorArea) {
    sizeSqft = safeNumber(property.sizeSqFt || property.floorArea);
    sizeSqm = Math.round(sizeSqft * 0.092903);
  } else if (property.sizeSqM) {
    sizeSqm = safeNumber(property.sizeSqM);
    sizeSqft = Math.round(sizeSqm * 10.7639);
  }

  return {
    id,
    url,
    price: priceVal,
    displayPrice,
    address: {
      displayAddress,
      postcode,
      outcode: parts[0] || "",
      incode: parts[1] || "",
      street: displayAddress.split(",")[0]?.trim().replace(/^(Flat|Unit|Apartment)\s+\S+\s*/i, "").trim() || "",
    },
    propertyType: safeString(property.propertyType || property.type || ""),
    propertySubType: safeString(property.propertySubType || property.subType || ""),
    bedrooms: safeNumber(property.bedrooms || property.beds),
    bathrooms: safeNumber(property.bathrooms || property.baths),
    tenure: safeString(property.tenure || ""),
    description,
    keyFeatures,
    images,
    floorplans,
    epcRating: safeString(property.epcRating || safeGet(property, "epc.currentRating")) || null,
    councilTaxBand: safeString(property.councilTaxBand) || null,
    latitude: safeNumber(property.latitude || safeGet(property, "location.lat")),
    longitude: safeNumber(property.longitude || safeGet(property, "location.lng")),
    agent: {
      name: safeString(property.agentName || safeGet(property, "agent.name") || safeGet(property, "branch.name")),
      branch: safeString(property.agentBranch || safeGet(property, "branch.branchName")),
      phone: safeString(property.agentPhone || safeGet(property, "branch.phone")),
    },
    sizeSqft,
    sizeSqm,
    numberOfFlats,
  };
}

function inferNumberOfFlats(description: string, keyFeatures: string[]): number | null {
  const allText = [description, ...keyFeatures].join(" ").toLowerCase();
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
