import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
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

  if (!analysis.pdfs) {
    return NextResponse.json(
      { error: "PDF not yet generated" },
      { status: 404 },
    );
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

  let result;
  try {
    result = await get(pdfUrl, { access: "private" });
  } catch {
    return NextResponse.json(
      { error: "Failed to retrieve PDF from storage" },
      { status: 502 },
    );
  }

  if (!result || result.statusCode !== 200 || !result.stream) {
    return NextResponse.json(
      { error: "PDF not found in storage" },
      { status: 404 },
    );
  }

  const filename = `${id}-${type}-memo.pdf`;

  return new Response(result.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(result.blob.size),
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
