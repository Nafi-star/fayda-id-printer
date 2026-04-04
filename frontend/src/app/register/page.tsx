"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AuthLogo } from "@/components/auth-logo";
import { AuthPageFrame } from "@/components/auth-page-frame";

const MIN_PW = 4;

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const confirmMismatch = useMemo(() => {
    if (confirmPassword.length === 0) return false;
    return password !== confirmPassword;
  }, [password, confirmPassword]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PW) {
      setError(`Password must be at least ${MIN_PW} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!agreed) {
      setError("You must agree to the Terms of Service.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { message?: string; pendingApproval?: boolean };
      if (!res.ok) {
        setError(data.message ?? "Register failed.");
        return;
      }
      router.push(data.pendingApproval ? "/login?pending=1" : "/login?verified=1");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageFrame>
      <div className="rounded-sm bg-white px-8 pb-10 pt-9 shadow-2xl">
        <div className="mb-5 flex flex-col items-center gap-3">
          <AuthLogo />
          <h1 className="text-center text-[1.35rem] font-semibold leading-snug text-zinc-600">
            Create your account
          </h1>
          <p className="text-center text-sm leading-relaxed text-zinc-500">
            Convert your National ID PDF or screenshot into a print-ready card image — fast and private.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-3 text-[15px] text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-sky-300 focus:ring-1 focus:ring-sky-300"
          />

          <div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="new-password"
              placeholder={`Password (min. ${MIN_PW} characters)`}
              minLength={MIN_PW}
              className="w-full rounded-md border border-zinc-200 bg-[#e8f4fc] px-3 py-3 text-[15px] text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-sky-300 focus:bg-[#e0f0fe] focus:ring-1 focus:ring-sky-300"
            />
          </div>

          <div>
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              required
              autoComplete="new-password"
              placeholder="Confirm Password"
              aria-invalid={confirmMismatch}
              className={`w-full rounded-md border bg-white px-3 py-3 text-[15px] text-zinc-800 outline-none placeholder:text-zinc-400 focus:ring-1 ${
                confirmMismatch
                  ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                  : "border-zinc-200 focus:border-sky-300 focus:ring-sky-300"
              }`}
            />
            {confirmMismatch ? (
              <p className="mt-1.5 text-sm font-medium text-red-600" role="alert">
                Passwords do not match
              </p>
            ) : null}
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-zinc-600 select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 accent-[#2563eb]"
            />
            <span>
              I agree to all{" "}
              <Link href="/terms" className="font-semibold text-[#2563eb] hover:underline">
                Terms of Service
              </Link>
            </span>
          </label>

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
          ) : null}

          <button
            disabled={loading || confirmMismatch}
            className="mt-2 flex h-12 w-full items-center justify-center rounded-md bg-[#60a5fa] text-base font-bold tracking-wide text-white uppercase shadow-sm transition hover:bg-[#3b82f6] disabled:opacity-60"
            type="submit"
          >
            {loading ? "Creating..." : "Sign Up"}
          </button>
        </form>

        <p className="mt-8 text-center text-[15px] text-zinc-500">
          Already have an account?{" "}
          <Link className="font-semibold text-[#2563eb] hover:underline" href="/login">
            Sign In
          </Link>
        </p>
      </div>
    </AuthPageFrame>
  );
}
