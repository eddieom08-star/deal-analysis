import { SubmitForm } from "@/components/submit-form";

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">New Analysis</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Paste a Rightmove listing URL for a freehold block of flats. The
          system will scrape the listing, gather comparable evidence, and
          produce Investment and Valuation memos.
        </p>
      </div>
      <SubmitForm />
    </div>
  );
}
