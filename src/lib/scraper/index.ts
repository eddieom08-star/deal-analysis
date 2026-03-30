import type { PropertyListing } from "@/lib/types";
import { scrapeRightmoveListing } from "./rightmove";
import { scrapeOnTheMarketListing } from "./onthemarket";
import { scrapeGenericListing } from "./generic";

export type ListingSource = "rightmove" | "onthemarket" | "zoopla" | "generic";

/**
 * Detect which property portal a URL belongs to.
 */
export function detectSource(url: string): ListingSource {
  const hostname = new URL(url).hostname.toLowerCase();

  if (hostname.includes("rightmove.co.uk")) return "rightmove";
  if (hostname.includes("onthemarket.com")) return "onthemarket";
  if (hostname.includes("zoopla.co.uk")) return "zoopla";

  return "generic";
}

/**
 * Scrape a property listing from any supported URL.
 * Routes to an optimized site-specific scraper when available,
 * falls back to a generic HTML + Claude extraction scraper.
 */
export async function scrapeListing(url: string): Promise<PropertyListing> {
  const source = detectSource(url);

  switch (source) {
    case "rightmove":
      return scrapeRightmoveListing(url);

    case "onthemarket":
      return scrapeOnTheMarketListing(url);

    case "zoopla":
      // Zoopla uses aggressive anti-scraping; fall through to generic
      console.log(`[scraper] Zoopla detected — using generic scraper`);
      return scrapeGenericListing(url);

    case "generic":
    default:
      console.log(`[scraper] Unknown site — using generic scraper for ${new URL(url).hostname}`);
      return scrapeGenericListing(url);
  }
}
