import { put, list, head } from "@vercel/blob";
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
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    },
  );
  return blob.url;
}

export async function getAnalysis(
  id: string,
): Promise<AnalysisRecord | null> {
  try {
    const blobInfo = await head(`analyses/${id}.json`);
    const response = await fetch(blobInfo.url);
    if (!response.ok) return null;
    return (await response.json()) as AnalysisRecord;
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
      const response = await fetch(blob.url);
      if (response.ok) {
        const data = (await response.json()) as AnalysisRecord;
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

export async function uploadPDF(
  analysisId: string,
  street: string,
  postcode: string,
  type: "investment-memo" | "valuation-memo",
  buffer: Buffer | Uint8Array,
): Promise<string> {
  const folder = `${slugify(street)}-${slugify(postcode)}`;
  const path = `pdfs/${folder}/${analysisId}-${type}.pdf`;

  const blob = await put(path, buffer, {
    access: "public",
    contentType: "application/pdf",
    addRandomSuffix: false,
  });

  return blob.url;
}
