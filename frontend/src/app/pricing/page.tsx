import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { getFreeTrialConversionLimit } from "@/lib/free-trial";

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.872l-3.236 4.53L7.53 10.53a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const paidPlans = [
  {
    name: "Starter",
    tagline: "Try a single print",
    price: "30",
    conversions: "1 conversion",
    gradient: "from-[#1e3a5f] via-[#0b2a55] to-[#152a4a]",
    ring: "ring-blue-500/30",
    check: "text-blue-500",
    popular: false,
    features: ["ID → print-ready PNG", "Standard quality", "Email support"],
  },
  {
    name: "Basic",
    tagline: "Personal use",
    price: "300",
    conversions: "11 conversions",
    gradient: "from-[#5c6310] via-[#717a0d] to-[#4d5a0c]",
    ring: "ring-lime-500/25",
    check: "text-lime-600",
    popular: false,
    features: ["10 + 1 free", "Priority queue", "Usage history"],
  },
  {
    name: "Standard",
    tagline: "Most popular",
    price: "1,200",
    conversions: "50 conversions",
    gradient: "from-zinc-800 via-black to-zinc-900",
    ring: "ring-amber-400/40",
    check: "text-zinc-800",
    popular: true,
    features: ["40 + 10 free", "Bulk-friendly", "24/7 support"],
  },
  {
    name: "Premium",
    tagline: "Teams & shops",
    price: "2,400",
    conversions: "100 conversions",
    gradient: "from-[#6b0a2e] via-[#870038] to-[#4a061f]",
    ring: "ring-rose-400/30",
    check: "text-rose-700",
    popular: false,
    features: ["80 + 20 free", "Bulk + priority", "Dedicated support"],
  },
  {
    name: "Enterprise",
    tagline: "High volume",
    price: "7,200",
    conversions: "400 conversions",
    gradient: "from-[#3d0060] via-[#50006d] to-[#2a0040]",
    ring: "ring-violet-400/35",
    check: "text-violet-700",
    popular: false,
    features: ["240 + 160 free", "40% volume discount", "Bulk processing"],
  },
] as const;

export default function PricingPage() {
  const trialLimit = getFreeTrialConversionLimit();
  const trialSummary =
    trialLimit === null
      ? "Unlimited conversions during this beta"
      : `${trialLimit} free conversion${trialLimit === 1 ? "" : "s"} included`;

  return (
    <AppShell active="pricing">
      <div className="relative">
        <div className="pointer-events-none absolute left-1/4 top-0 h-48 w-48 -translate-x-1/2 rounded-full bg-[#facc15]/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-20 right-0 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

        <header className="relative mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#facc15]/90">Simple pricing</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Choose your perfect plan</h1>
          <p className="mt-4 text-lg text-zinc-400">
            Start free today. Paid tiers will unlock higher volume — payment integration is on the way.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-zinc-300">
              No card required for free trial
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-zinc-300">
              PNG optimized for printing
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-zinc-300">
              Data deleted after 24h
            </span>
          </div>
        </header>

        {/* Free trial — featured */}
        <div className="relative mx-auto mt-14 max-w-lg">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-emerald-500/50 via-[#facc15]/40 to-cyan-500/50 opacity-75 blur-lg" />
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0f172a] p-8 shadow-2xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-400/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                  Free trial
                </span>
                <h2 className="mt-4 text-2xl font-bold text-white">Start at zero cost</h2>
                <p className="mt-2 text-zinc-400">
                  Full converter, previews, and downloads — {trialSummary.toLowerCase()}.
                </p>
              </div>
              <div className="text-right sm:pt-6">
                <p className="text-5xl font-extrabold text-white">0</p>
                <p className="text-sm font-medium text-emerald-300/90">BIRR</p>
              </div>
            </div>
            <ul className="mt-6 space-y-3 text-sm text-zinc-300">
              {[
                "Official Fayda PDF or clear screenshot",
                "Live preview before download",
                "Print-ready high-resolution PNG",
              ].map((f) => (
                <li key={f} className="flex items-center gap-3">
                  <CheckIcon className="h-5 w-5 shrink-0 text-emerald-400" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-teal-400"
              >
                Create free account
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex flex-1 items-center justify-center rounded-full border border-white/20 bg-white/5 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Go to converter
              </Link>
            </div>
          </div>
        </div>

        <h2 className="relative mx-auto mt-20 max-w-2xl text-center text-2xl font-bold text-white">
          Paid plans
          <span className="mt-2 block text-base font-normal text-zinc-500">
            Higher limits when we enable Tellbirr / CBE — buttons are disabled until then.
          </span>
        </h2>

        <div className="relative mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {paidPlans.map((plan) => (
            <div
              key={plan.name}
              className={`group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0d1420] shadow-xl transition duration-300 hover:-translate-y-1 hover:border-white/15 hover:shadow-2xl ${
                plan.popular ? `ring-2 ${plan.ring} xl:scale-[1.02]` : ""
              }`}
            >
              {plan.popular ? (
                <div className="absolute right-4 top-4 z-10 rounded-full bg-[#facc15] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0f172a] shadow-lg">
                  Best value
                </div>
              ) : null}
              <div className={`bg-gradient-to-br px-6 pb-8 pt-8 text-white ${plan.gradient}`}>
                <p className="text-xs font-bold uppercase tracking-widest text-white/80">{plan.name}</p>
                <p className="mt-1 text-sm text-white/70">{plan.tagline}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tabular-nums">{plan.price}</span>
                  <span className="text-sm font-semibold text-white/80">BIRR</span>
                </div>
                <p className="mt-2 text-sm font-medium text-white/85">{plan.conversions}</p>
              </div>
              <ul className="flex flex-1 flex-col gap-3 border-t border-white/5 bg-white px-5 py-6 text-sm text-zinc-700">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <CheckIcon className={`mt-0.5 h-5 w-5 shrink-0 ${plan.check}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-zinc-100 bg-zinc-50/80 p-5">
                <button
                  type="button"
                  disabled
                  title="Payment options coming soon"
                  className="w-full cursor-not-allowed rounded-2xl border border-dashed border-zinc-300 bg-white py-3.5 text-center text-xs font-bold uppercase tracking-wide text-zinc-500"
                >
                  Payments coming soon
                </button>
                <p className="mt-2 text-center text-[11px] text-zinc-500">Tellbirr / CBE wiring is next on our roadmap.</p>
              </div>
            </div>
          ))}
        </div>

        <section className="relative mx-auto mt-20 max-w-4xl rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f172a] to-[#1a1025] p-8 sm:p-10">
          <h3 className="text-center text-xl font-bold text-white sm:text-2xl">Why people use Fayda ID Card Converter</h3>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { t: "Print-ready", d: "Wallet-sized PNG layout tuned for sharp printing at home or at a shop." },
              { t: "Fast", d: "Queue-based processing — your card preview appears as soon as the job finishes." },
              { t: "Private", d: "Uploads and outputs are purged on a short lifecycle; see Terms for details." },
            ].map((item) => (
              <div key={item.t} className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 text-center sm:text-left">
                <p className="font-semibold text-[#facc15]">{item.t}</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.d}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
