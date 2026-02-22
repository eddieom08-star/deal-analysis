import { NextResponse } from "next/server";
import { deleteAnalysis } from "@/lib/storage/blob";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await deleteAnalysis(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Analysis not found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    console.error("Delete failed:", error);
    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 },
    );
  }
}
