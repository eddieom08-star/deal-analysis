import { NextResponse } from "next/server";
import { getAnalysis } from "@/lib/storage/blob";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  if (type !== "investment" && type !== "valuation") {
    return NextResponse.json(
      { error: "type must be 'investment' or 'valuation'" },
      { status: 400 },
    );
  }

  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdfUrl =
    type === "investment"
      ? analysis.pdfs.investmentMemoUrl
      : analysis.pdfs.valuationMemoUrl;

  if (!pdfUrl) {
    return NextResponse.json(
      { error: "PDF not yet generated" },
      { status: 404 },
    );
  }

  return NextResponse.redirect(pdfUrl);
}
