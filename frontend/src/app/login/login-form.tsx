"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { AuthLogo } from "@/components/auth-logo";
import { AuthPageFrame } from "@/components/auth-page-frame";

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20.118a7.5 7.5 0 0115 0" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
      />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, remember }),
      });

      const data = (await res.json()) as { message?: string; ok?: boolean };
      if (!res.ok) {
        setError(data.message ?? "Login failed.");
        return;
      }

      router.push("/dashboard");
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
          <p className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            PDF to ID in seconds
          </p>
          <h1 className="text-center text-[1.35rem] font-semibold leading-snug text-zinc-800">
            Sign in — Fayda ID Card Converter
          </h1>
          <p className="text-center text-sm leading-relaxed text-zinc-600">
            Convert your National ID PDF to a high-quality, print-ready ID card format instantly. The most reliable Fayda
            ID converter for Ethiopian digital IDs.
          </p>
        </div>

        {verified ? (
          <div className="mb-5 rounded-md bg-[#d1fae5] px-3 py-3 text-center text-sm font-medium text-[#065f46]">
            Email Verified Successfully, Login To Continue
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="relative">
            <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-zinc-500" />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              className="w-full rounded-md border-0 bg-[#E8F0FE] py-3.5 pl-11 pr-3 text-[15px] text-zinc-800 placeholder:text-zinc-500 outline-none ring-0 focus:bg-[#dce8fb]"
            />
          </div>

          <div className="relative">
            <PencilIcon className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-zinc-500" />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="current-password"
              placeholder="Password"
              className="w-full rounded-md border-0 bg-[#E8F0FE] py-3.5 pl-11 pr-3 text-[15px] text-zinc-800 placeholder:text-zinc-500 outline-none ring-0 focus:bg-[#dce8fb]"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1 text-[15px]">
            <label className="flex cursor-pointer items-center gap-2 text-zinc-600 select-none">
              <input
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-zinc-600"
              />
              Remember me
            </label>
            <a className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-900" href="/forgot">
              <LockIcon className="text-zinc-800" />
              Forgot pwd?
            </a>
          </div>

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
          ) : null}

          <button
            disabled={loading}
            className="mt-2 flex h-12 w-full items-center justify-center rounded-md bg-[#007bff] text-base font-bold text-white shadow-sm transition hover:bg-[#0069d9] disabled:opacity-60"
            type="submit"
          >
            {loading ? "Signing in..." : "Log In"}
          </button>
        </form>

        <p className="mt-8 text-center text-[15px] text-zinc-500">
          Don&apos;t have an account?{" "}
          <a className="font-semibold text-[#007bff] hover:underline" href="/register">
            Sign Up
          </a>
        </p>
      </div>
    </AuthPageFrame>
  );
}
