"use client";

import { useState } from "react";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { message?: string; ok?: boolean; token?: string };
      if (!res.ok) {
        setError(data.message ?? "Request failed.");
        return;
      }
      if (data.token) {
        setMessage(`Dev token (use for reset): ${data.token}`);
      } else {
        setMessage("If this email exists, reset instructions were sent.");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020a2b] px-4 py-10 text-zinc-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_40%,rgba(37,99,235,0.35),transparent_35%),radial-gradient(circle_at_80%_45%,rgba(59,130,246,0.3),transparent_40%)]" />
      <div className="relative mx-auto w-full max-w-md rounded-sm bg-white p-6 shadow-2xl">
        <div className="mb-4 flex flex-col items-center gap-2">
          <div className="h-9 w-9 rounded-full border border-zinc-500" />
          <h1 className="text-center text-[28px] font-semibold leading-tight text-zinc-600">
            Recover Password
          </h1>
        </div>
        <p className="mb-4 text-center text-sm text-zinc-500">
          Enter your Email and instructions will be sent to you!
        </p>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              placeholder="Email"
              className="w-full border border-zinc-200 bg-[#f5f6fa] px-3 py-3 text-base outline-none"
            />
          </label>

          {error ? (
            <p className="border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {message ? (
            <p className="border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-700">
              {message}
            </p>
          ) : null}

          <button
            disabled={loading}
            className="mt-2 flex h-12 w-full items-center justify-center bg-[#5ea5ef] text-3xl font-medium text-white disabled:opacity-60"
            type="submit"
          >
            {loading ? "Sending..." : "Reset"}
          </button>
        </form>

        <div className="mt-8 text-center text-lg text-zinc-500">
          Remembered?{" "}
          <a className="font-semibold text-[#2284f5] hover:underline" href="/login">
            Back to login
          </a>
        </div>
      </div>
    </div>
  );
}

