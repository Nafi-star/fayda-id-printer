"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { AuthLogo } from "@/components/auth-logo";
import { AuthPageFrame } from "@/components/auth-page-frame";

export function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });

      const data = (await res.json()) as { message?: string; ok?: boolean };
      if (!res.ok) {
        setError(data.message ?? "Reset failed.");
        return;
      }

      router.push("/login");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageFrame>
      <div className="rounded-sm bg-white px-8 pb-10 pt-9 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-3">
          <AuthLogo />
          <h1 className="text-center text-[1.35rem] font-semibold leading-snug text-zinc-600">Reset Password</h1>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            minLength={4}
            placeholder="New password"
            className="w-full rounded-md border border-zinc-200 bg-[#f5f6fa] px-3 py-3 text-[15px] outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-300"
          />

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
          ) : null}

          <button
            disabled={loading}
            className="mt-2 flex h-12 w-full items-center justify-center rounded-md bg-[#60a5fa] text-base font-semibold text-white disabled:opacity-60"
            type="submit"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>

        {token ? (
          <p className="mt-4 text-xs text-zinc-500">Token received. In production, this token comes from your email link.</p>
        ) : (
          <p className="mt-4 text-xs text-zinc-500">Missing token. Try the reset link again.</p>
        )}
      </div>
    </AuthPageFrame>
  );
}
