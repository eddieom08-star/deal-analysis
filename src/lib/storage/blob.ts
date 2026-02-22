import { put, list, head, get, del } from "@vercel/blob";
import type { AnalysisRecord } from "@/lib/types";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function saveAnalysis(analysis: AnalysisRecord): Promise<string> {
  analysis.updatedAt = new Date().toISOString();
  const blob = await put(
    `analyses/${analysis.id}.json`,
    JSON.stringify(analysis),
    {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    },
  );
  return blob.url;
}

export async function getAnalysis(
  id: string,
): Promise<AnalysisRecord | null> {
  try {
    const result = await get(`analyses/${id}.json`, { access: "private" });
    if (!result || result.statusCode !== 200) return null;

    // Read stream to text
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const text = new TextDecoder().decode(
      new Uint8Array(chunks.reduce((acc, chunk) => acc.concat(Array.from(chunk)), [] as number[]))
    );
    const parsed = JSON.parse(text) as AnalysisRecord;

    // Validate and fix corrupted PropertyData fields
    if (parsed.comparables?.propertyData) {
      if (parsed.comparables.propertyData.soldPrices && !Array.isArray(parsed.comparables.propertyData.soldPrices.data)) {
        console.warn(`Corrupted soldPrices.data for analysis ${id}, resetting to []`);
        parsed.comparables.propertyData.soldPrices.data = [];
      }
      if (parsed.comparables.propertyData.soldPricesPerSqft && !Array.isArray(parsed.comparables.propertyData.soldPricesPerSqft.data)) {
        console.warn(`Corrupted soldPricesPerSqft.data for analysis ${id}, resetting to []`);
        parsed.comparables.propertyData.soldPricesPerSqft.data = [];
      }
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function listAnalyses(): Promise<AnalysisRecord[]> {
  const { blobs } = await list({ prefix: "analyses/" });
  const analyses: AnalysisRecord[] = [];

  for (const blob of blobs) {
    if (!blob.pathname.endsWith(".json")) continue;
    try {
      const result = await get(blob.pathname, { access: "private" });
      if (result && result.statusCode === 200) {
        const reader = result.stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        const text = new TextDecoder().decode(
          new Uint8Array(chunks.reduce((acc, chunk) => acc.concat(Array.from(chunk)), [] as number[]))
        );
        const data = JSON.parse(text) as AnalysisRecord;
        analyses.push(data);
      }
    } catch {
      // Skip corrupted records
    }
  }

  return analyses.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function deleteAnalysis(id: string): Promise<void> {
  const analysis = await getAnalysis(id);
  if (!analysis) {
    throw new Error("Analysis not found");
  }

  const pathsToDelete: string[] = [`analyses/${id}.json`];

  if (analysis.listing?.address.street && analysis.listing?.address.postcode) {
    const folder = `${slugify(analysis.listing.address.street)}-${slugify(analysis.listing.address.postcode)}`;
    pathsToDelete.push(`pdfs/${folder}/${id}-investment-memo.pdf`);
    pathsToDelete.push(`pdfs/${folder}/${id}-valuation-memo.pdf`);
  }

  await del(pathsToDelete);
}

export async function uploadPDF(
  analysisId: string,
  street: string,
  postcode: string,
  type: "investment-memo" | "valuation-memo",
  buffer: Buffer | Uint8Array,
): Promise<string> {
  const folder = `${slugify(street)}-${slugify(postcode)}`;
  const path = `pdfs/${folder}/${analysisId}-${type}.pdf`;

  // Convert Uint8Array to Buffer if needed for Vercel Blob compatibility
  const bufferData = buffer instanceof Buffer ? buffer : Buffer.from(buffer);

  const blob = await put(path, bufferData, {
    access: "private",
    contentType: "application/pdf",
    addRandomSuffix: false,
  });

  return blob.url;
}
