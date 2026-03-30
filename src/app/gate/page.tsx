"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GatePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to send code");
      return;
    }

    setStep("code");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Read code directly from the input element to avoid stale React state
    // during paste/autofill where the form submits before setState commits
    const form = e.target as HTMLFormElement;
    const codeInput = form.querySelector<HTMLInputElement>('input[inputmode="numeric"]');
    const currentCode = codeInput?.value.replace(/\D/g, "").slice(0, 6) || code;

    if (currentCode.length !== 6) {
      setLoading(false);
      setError("Enter all 6 digits");
      return;
    }

    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: currentCode }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Verification failed");
      return;
    }

    router.push("/");
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 sm:p-8">
          <h1 className="mb-1 text-xl font-semibold">Deal Analysis</h1>
          <p className="mb-6 text-sm text-zinc-500">
            {step === "email"
              ? "Enter your email to receive an access code."
              : `Code sent to ${email}`}
          </p>

          {step === "email" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-base placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 py-3 text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-center text-2xl font-mono tracking-[0.3em] placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full rounded-lg bg-blue-600 py-3 text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                }}
                className="w-full rounded-lg py-2.5 text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors min-h-[44px]"
              >
                Use a different email
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
