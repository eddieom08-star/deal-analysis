import { NextResponse } from "next/server";
import { getAnalysis } from "@/lib/storage/blob";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const analysis = await getAnalysis(id);

  if (!analysis) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: analysis.id,
    status: analysis.status,
    error: analysis.error,
    pdfs: analysis.pdfs,
    updatedAt: analysis.updatedAt,
    listing: analysis.listing
      ? {
          address: analysis.listing.address.displayAddress,
          price: analysis.listing.displayPrice,
          propertyType: analysis.listing.propertyType,
        }
      : null,
    investmentMemo: analysis.investmentMemo
      ? {
          recommendation: analysis.investmentMemo.recommendation,
          keyMetrics: analysis.investmentMemo.keyMetrics,
        }
      : null,
  });
}
