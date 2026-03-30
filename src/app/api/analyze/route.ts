import { NextResponse, after } from "next/server";
import { nanoid } from "nanoid";
import { submitAnalysisSchema, AnalysisStatus } from "@/lib/types";
import type { AnalysisRecord } from "@/lib/types";
import { saveAnalysis } from "@/lib/storage/blob";
import { runAnalysisPipeline } from "@/lib/pipeline/run-analysis";

export const maxDuration = 300;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = submitAnalysisSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { listingUrl, userNotes, reportEmail } = parsed.data;
  const id = nanoid(12);

  const analysis: AnalysisRecord = {
    id,
    status: AnalysisStatus.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    input: {
      listingUrl,
      userNotes: userNotes || "",
      reportEmail: reportEmail || process.env.REPORT_EMAIL || "",
    },
    listing: null,
    comparables: null,
    investmentMemo: null,
    valuationMemo: null,
    pdfs: {
      investmentMemoUrl: null,
      valuationMemoUrl: null,
    },
    emailSentAt: null,
    error: null,
  };

  try {
    await saveAnalysis(analysis);
  } catch (error) {
    console.error("Failed to save analysis:", error);
    return NextResponse.json(
      { error: "Failed to save analysis. Please try again." },
      { status: 500 }
    );
  }

  // Run pipeline in background — response returns immediately
  after(async () => {
    await runAnalysisPipeline(analysis);
  });

  return NextResponse.json({ id }, { status: 201 });
}
