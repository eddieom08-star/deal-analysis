import { NextResponse } from "next/server";
import { getAnalysis } from "@/lib/storage/blob";
import { runAnalysisPipeline } from "@/lib/pipeline/run-analysis";
import { AnalysisStatus } from "@/lib/types";

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const analysis = await getAnalysis(id);

    if (!analysis) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 }
      );
    }

    if (analysis.status !== AnalysisStatus.FAILED) {
      return NextResponse.json(
        { error: "Only failed analyses can be retried" },
        { status: 400 }
      );
    }

    if ((analysis.retryCount || 0) >= 3) {
      return NextResponse.json(
        { error: "Maximum retry attempts exceeded" },
        { status: 400 }
      );
    }

    // Retry pipeline (will resume from last completed step)
    await runAnalysisPipeline(analysis);

    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    console.error("Retry failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
