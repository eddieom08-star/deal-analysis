"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteAnalysisButton({ analysisId }: { analysisId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/analyze/${analysisId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Delete failed");

      router.refresh();
    } catch {
      setDeleting(false);
      setConfirming(false);
      alert("Failed to delete analysis");
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setConfirming(true);
        }}
        className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
      >
        Delete
      </button>
    );
  }

  return (
    <div
      className="flex gap-2"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
      >
        {deleting ? "Deleting..." : "Confirm"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        disabled={deleting}
        className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-700 disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
