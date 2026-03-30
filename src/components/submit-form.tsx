"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SubmitForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Accept any valid URL — site-specific validation happens server-side
  let isValidUrl = false;
  try {
    if (url) {
      const parsed = new URL(url);
      isValidUrl = parsed.protocol === "https:" || parsed.protocol === "http:";
    }
  } catch {
    isValidUrl = false;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidUrl) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingUrl: url,
          userNotes: notes || undefined,
          reportEmail: email || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed: ${res.status}`);
      }

      const { id } = await res.json();
      router.push(`/analysis/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="url"
          className="block text-sm font-medium text-zinc-300 mb-2"
        >
          Property Listing URL
        </label>
        <input
          id="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.rightmove.co.uk/properties/..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          required
        />
        {url && !isValidUrl && (
          <p className="mt-1 text-sm text-red-400">
            Enter a valid property listing URL
          </p>
        )}
        <p className="mt-2 text-xs text-zinc-500">
          Supports Rightmove, OnTheMarket, and other UK property listing sites
        </p>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-zinc-300 mb-2"
        >
          Additional Notes{" "}
          <span className="text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Any additional context - e.g. 'Block of 4 flats, all self-contained, vacant possession expected...'"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          maxLength={5000}
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-zinc-300 mb-2"
        >
          Email for Reports{" "}
          <span className="text-zinc-500">(optional - defaults to configured email)</span>
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!isValidUrl || loading}
        className="w-full rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Starting Analysis..." : "Analyze Property"}
      </button>
    </form>
  );
}
