"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { JobCard, type JobCardModel } from "@/components/job-card";
import { LogoMark } from "@/components/brand-logo";
import { useI18n } from "@/i18n/context";

function CloudUploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.35 10.04A7.49 7.49 0 0012 4C9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
    </svg>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [jobs, setJobs] = useState<JobCardModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me", { credentials: "include" });
      const meData = (await meRes.json()) as { user: { id: string } | null };
      if (!meData.user) {
        router.replace("/login");
        return;
      }

      const res = await fetch("/api/jobs", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { jobs: JobCardModel[] };
      setJobs(data.jobs);
      setLoading(false);
    })();
  }, [router]);

  return (
    <AppShell active="history">
      <div className="relative">
        <div className="pointer-events-none absolute -left-4 top-0 h-32 w-32 rounded-full bg-[#facc15]/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-24 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />

        <header className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-400">
              <LogoMark className="h-6 w-6" withRing={false} />
              {t("history.badge")}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{t("history.title")}</h1>
            <p className="mt-2 max-w-xl text-zinc-400">{t("history.subtitle")}</p>
          </div>
          <a
            href="/dashboard"
            className="relative inline-flex items-center justify-center rounded-full bg-[#facc15] px-6 py-3 text-sm font-bold text-[#0f172a] shadow-lg shadow-yellow-500/20 transition hover:bg-[#fde047]"
          >
            {t("history.newConversion")}
          </a>
        </header>

        <div className="relative mt-10 rounded-3xl border border-white/[0.06] bg-[#0d1420] p-6 sm:p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#facc15] border-t-transparent" />
              <p className="mt-4 text-sm">{t("history.loading")}</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-14 text-center">
              <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[#facc15] to-amber-600 text-[#0f172a] shadow-xl shadow-amber-500/30">
                <CloudUploadIcon className="h-9 w-9" />
              </div>
              <h2 className="text-2xl font-bold text-white">{t("history.emptyTitle")}</h2>
              <p className="mx-auto mt-2 max-w-md text-zinc-400">{t("history.emptySub")}</p>
              <a
                href="/dashboard"
                className="mt-8 inline-flex rounded-full bg-[#facc15] px-8 py-3.5 text-base font-bold text-[#0f172a] transition hover:bg-[#fde047]"
              >
                {t("history.goConverter")}
              </a>
            </div>
          ) : (
            <ul className="space-y-4">
              {jobs.map((job) => (
                <li key={job.id}>
                  <JobCard job={job} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
