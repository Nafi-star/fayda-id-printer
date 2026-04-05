"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { JobCard, type JobCardModel } from "@/components/job-card";
import { useI18n } from "@/i18n/context";

type User = { id: string; email: string };
type Job = JobCardModel & { updated_at: string };

type UsageInfo = {
  conversionsUsed: number;
  freeTrialLimit: number | null;
  remaining: number | null;
  isUnlimited: boolean;
};

type UploadConfig = { directUpload: boolean; maxMultipartBytes: number };

export default function DashboardPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("No file selected");
  const [mode, setMode] = useState<"pdf" | "image">("pdf");
  const [colorMode, setColorMode] = useState<"color" | "bw">("color");
  const [loading, setLoading] = useState(true);
  /** false on server and first client paint — avoids Convert button disabled mismatch with Next SSR. */
  const [mounted, setMounted] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [previewJob, setPreviewJob] = useState<Job | null>(null);
  const [previewBust, setPreviewBust] = useState(0);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [uploadConfig, setUploadConfig] = useState<UploadConfig | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async (opts?: { clearError?: boolean }) => {
    if (opts?.clearError !== false) setError(null);
    const meRes = await fetch("/api/auth/me", { credentials: "include" });
    const meData = (await meRes.json()) as { user: User | null };
    if (!meRes.ok || !meData.user) {
      router.replace("/login");
      return false;
    }
    setUser(meData.user);
    const [jobsRes, usageRes] = await Promise.all([
      fetch("/api/jobs", { credentials: "include" }),
      fetch("/api/account/usage", { credentials: "include" }),
    ]);
    if (!jobsRes.ok) {
      setError(t("dashboard.errLoadJobs"));
      return false;
    }
    const jobsData = (await jobsRes.json()) as { jobs: Job[] };
    setJobs(jobsData.jobs);
    if (usageRes.ok) {
      setUsage((await usageRes.json()) as UsageInfo);
    }
    return true;
  }, [router, t]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    void fetch("/api/uploads/config", { credentials: "include" })
      .then((r) => r.json())
      .then((d: unknown) => {
        const o = d as { directUpload?: boolean; maxMultipartBytes?: number };
        setUploadConfig({
          directUpload: Boolean(o.directUpload),
          maxMultipartBytes:
            typeof o.maxMultipartBytes === "number" ? o.maxMultipartBytes : 25 * 1024 * 1024,
        });
      })
      .catch(() =>
        setUploadConfig({ directUpload: false, maxMultipartBytes: 25 * 1024 * 1024 }),
      );
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await refresh({ clearError: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!pendingJobId) return;

    async function poll() {
      const res = await fetch(`/api/jobs/${pendingJobId}`, { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { job?: Job };
      const job = data.job;
      if (!job) return;

      if (job.status === "completed" || job.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setPendingJobId(null);
        setConverting(false);
        await refresh();
        if (job.status === "completed") {
          setPreviewJob(job);
          setPreviewBust((b) => b + 1);
        }
        if (job.status === "failed") {
          setError(job.error_message ?? "Conversion failed.");
        }
      }
    }

    pollRef.current = setInterval(poll, 300);
    poll();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pendingJobId, refresh]);

  function applyFile(file: File | null) {
    setSelectedFile(file);
    setFileName(file?.name ?? "No file selected");
    setError(null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) applyFile(file);
  }

  async function runConversion() {
    setError(null);
    if (!selectedFile) {
      setError(mode === "pdf" ? t("dashboard.errNeedPdf") : t("dashboard.errNeedImage"));
      return;
    }

    const maxMultipart = uploadConfig?.maxMultipartBytes ?? 25 * 1024 * 1024;
    if (!uploadConfig?.directUpload && selectedFile.size > maxMultipart) {
      setError(t("dashboard.errVercelUploadLimit"));
      return;
    }

    setConverting(true);
    setPreviewJob(null);
    try {
      let inputFileKey: string;

      if (uploadConfig?.directUpload) {
        const presRes = await fetch("/api/uploads/presign", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: selectedFile.name,
            contentType: selectedFile.type || "application/octet-stream",
            fileSize: selectedFile.size,
          }),
        });
        const presData = (await presRes.json()) as {
          uploadUrl?: string;
          inputFileKey?: string;
          contentType?: string;
          message?: string;
        };
        if (!presRes.ok || !presData.uploadUrl || !presData.inputFileKey) {
          setError(presData.message ?? t("dashboard.errDirectUploadFailed"));
          setConverting(false);
          return;
        }
        const putRes = await fetch(presData.uploadUrl, {
          method: "PUT",
          body: selectedFile,
          headers: { "Content-Type": presData.contentType ?? "application/octet-stream" },
        });
        if (!putRes.ok) {
          setError(t("dashboard.errDirectUploadCors"));
          setConverting(false);
          return;
        }
        inputFileKey = presData.inputFileKey;
      } else {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const uploadRes = await fetch("/api/uploads", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const uploadData = (await uploadRes.json()) as { inputFileKey?: string; message?: string };
        if (!uploadRes.ok || !uploadData.inputFileKey) {
          setError(uploadData.message ?? "Upload failed.");
          setConverting(false);
          return;
        }
        inputFileKey = uploadData.inputFileKey;
      }

      const jobRes = await fetch("/api/jobs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputFileKey,
          colorMode,
        }),
      });
      const jobData = (await jobRes.json()) as { jobId?: string; message?: string };
      if (!jobRes.ok || !jobData.jobId) {
        setError(jobData.message ?? t("dashboard.errStart"));
        setConverting(false);
        return;
      }
      setPendingJobId(jobData.jobId);
    } catch {
      setError(t("dashboard.errGeneric"));
      setConverting(false);
    }
  }

  const acceptAttr = mode === "pdf" ? "application/pdf,.pdf" : "image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp";
  const dropHint = mode === "pdf" ? t("dashboard.dropPdf") : t("dashboard.dropImage");

  const trialExhausted = Boolean(
    usage && !usage.isUnlimited && usage.remaining !== null && usage.remaining <= 0,
  );

  const trialProgressPct =
    usage && !usage.isUnlimited && usage.freeTrialLimit && usage.freeTrialLimit > 0
      ? Math.min(100, (usage.conversionsUsed / usage.freeTrialLimit) * 100)
      : usage?.isUnlimited
        ? 35
        : 0;

  return (
    <AppShell active="convert" userLabel={user?.email?.slice(0, 2).toUpperCase() ?? "S7"}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#facc15]/35 bg-gradient-to-r from-[#facc15]/10 to-transparent px-3 py-1.5 text-[11px] font-semibold text-[#fde68a] shadow-sm sm:text-xs">
          <span className="text-sm opacity-90" aria-hidden>
            ✦
          </span>
          <span>{t("dashboard.qualityBadge")}</span>
        </div>
        <p className="text-[11px] text-zinc-500 sm:max-w-xs sm:text-right sm:text-xs">{t("dashboard.subtag")}</p>
      </div>

      <div className="mb-5 inline-flex max-w-md rounded-full bg-zinc-950/90 p-0.5 shadow-inner ring-1 ring-white/10">
        <button
          type="button"
          onClick={() => {
            setMode("pdf");
            applyFile(null);
          }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition sm:gap-2 sm:px-5 sm:text-sm ${
            mode === "pdf" ? "bg-[#334155] text-white shadow-md" : "text-zinc-400 hover:text-white"
          }`}
        >
          <span className="text-sm leading-none sm:text-base">📄</span>
          {t("dashboard.pdfMode")}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("image");
            applyFile(null);
          }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition sm:gap-2 sm:px-5 sm:text-sm ${
            mode === "image" ? "bg-[#334155] text-white shadow-md" : "text-zinc-400 hover:text-white"
          }`}
        >
          <span className="text-sm leading-none sm:text-base">🖼</span>
          {t("dashboard.screenshotMode")}
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-white/10 bg-[#0f172a]/90 p-5 sm:p-8">
          <h2 className="text-lg font-bold leading-snug text-white sm:text-2xl">{t("dashboard.headline")}</h2>
          <p className="mt-2 text-sm text-zinc-400">{t("dashboard.subhead")}</p>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="mt-5 rounded-2xl border-2 border-dashed border-[#facc15]/90 bg-gradient-to-b from-[#0f172a]/80 to-[#0b1220]/90 p-8 text-center shadow-inner transition hover:border-[#fde047] sm:p-10"
          >
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-[#facc15] text-2xl text-[#0f172a] shadow-lg shadow-yellow-500/25 sm:h-16 sm:w-16 sm:text-3xl">
              {mode === "pdf" ? "📄" : "🖼"}
            </div>
            <p className="text-sm font-semibold text-[#facc15] sm:text-base">{dropHint}</p>
            <label className="mt-5 inline-block cursor-pointer rounded-full bg-[#facc15] px-8 py-2.5 text-xs font-bold text-[#0f172a] shadow-md transition hover:bg-[#fde047] sm:px-10 sm:py-3 sm:text-sm">
              {t("dashboard.chooseFile")}
              <input
                type="file"
                accept={acceptAttr}
                className="hidden"
                onChange={(e) => applyFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <p className="mt-3 text-xs text-zinc-500 sm:text-sm">
              {selectedFile ? fileName : t("dashboard.noFile")}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="w-full text-[10px] font-bold uppercase tracking-wider text-zinc-500 sm:w-auto sm:mr-2">
              {locale === "am" ? "ቀለም" : "Color"}
            </span>
            <button
              type="button"
              onClick={() => setColorMode("color")}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition sm:px-5 sm:py-2 sm:text-sm ${
                colorMode === "color"
                  ? "border-[#facc15] bg-[#1e293b] text-[#facc15]"
                  : "border-white/35 text-zinc-200 hover:border-white/55"
              }`}
            >
              {t("dashboard.color")}
            </button>
            <button
              type="button"
              onClick={() => setColorMode("bw")}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition sm:px-5 sm:py-2 sm:text-sm ${
                colorMode === "bw"
                  ? "border-[#facc15] bg-[#1e293b] text-[#facc15]"
                  : "border-white/35 text-zinc-200 hover:border-white/55"
              }`}
            >
              {t("dashboard.bw")}
            </button>
          </div>

          <button
            type="button"
            disabled={!mounted || loading || converting || trialExhausted}
            onClick={runConversion}
            className="mt-6 h-12 w-full rounded-full bg-[#3b82f6] text-base font-bold text-white shadow-lg shadow-blue-500/25 transition hover:bg-[#2563eb] disabled:cursor-not-allowed disabled:opacity-50 sm:mt-8 sm:h-14 sm:text-lg"
          >
            {trialExhausted
              ? t("dashboard.trialExhaustedBtn")
              : converting || pendingJobId
                ? t("dashboard.converting")
                : t("dashboard.convert")}
          </button>

          {trialExhausted ? (
            <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {t("dashboard.trialExhaustedMsg")}{" "}
              <a href="/pricing" className="font-semibold text-[#facc15] underline hover:no-underline">
                {t("dashboard.seePricing")}
              </a>
            </p>
          ) : null}

          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

          <p className="mt-4 flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-zinc-400 sm:text-xs">
            <span aria-hidden>🔒</span>
            <span>
              {t("dashboard.privacyNote")}{" "}
              <a href="/terms" className="text-[#7dd3fc] underline hover:text-white">
                {t("dashboard.terms")}
              </a>
            </span>
          </p>

          {previewJob?.id ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-[#0b1222] p-4 sm:mt-10 sm:p-5">
              <h3 className="text-base font-semibold text-white sm:text-lg">{t("dashboard.previewTitle")}</h3>
              <p className="mt-1 text-xs text-zinc-400 sm:text-sm">{t("dashboard.previewHint")}</p>
              <div className="mt-4 flex justify-center rounded-xl bg-zinc-900/80 p-3 sm:p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/jobs/${previewJob.id}/download?inline=1&t=${previewBust}`}
                  alt=""
                  className="max-h-[360px] w-auto max-w-full rounded-lg border border-white/10 object-contain shadow-xl sm:max-h-[420px]"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={`/api/jobs/${previewJob.id}/download`}
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-[#facc15] px-6 py-2.5 text-center text-sm font-bold text-[#0f172a] hover:bg-[#eab308] sm:flex-none sm:py-3"
                >
                  {t("dashboard.downloadPng")}
                </a>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0f172a] to-[#0a1628] p-6 shadow-lg shadow-black/30">
            <h3 className="text-xl font-bold text-white">{t("dashboard.usageTitle")}</h3>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#3b82f6]/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white ring-1 ring-white/10">
              {t("dashboard.freeTrial")}
            </span>
            <div className="mt-5 text-sm text-zinc-400">{t("dashboard.conversionsUsed")}</div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-3xl font-bold tabular-nums text-white">
                {usage?.conversionsUsed ?? jobs.length}
              </span>
              {usage && !usage.isUnlimited && usage.freeTrialLimit != null ? (
                <span className="text-sm font-medium text-zinc-500">
                  {t("dashboard.ofFree")} <span className="text-zinc-300">{usage.freeTrialLimit}</span>{" "}
                  {t("dashboard.free")}
                </span>
              ) : (
                <span className="text-sm font-medium text-emerald-400/90">{t("dashboard.unlimitedBeta")}</span>
              )}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-cyan-400 transition-all duration-500"
                style={{ width: `${trialProgressPct}%` }}
              />
            </div>
            {usage && !usage.isUnlimited && usage.remaining != null ? (
              <p className="mt-3 text-sm text-zinc-400">
                <span className="font-semibold text-[#facc15]">{usage.remaining}</span>{" "}
                {usage.remaining === 1 ? t("dashboard.remainingOne") : t("dashboard.remaining")}
              </p>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">{t("dashboard.enjoyBeta")}</p>
            )}
          </div>

          <div className="rounded-2xl border border-[#facc15]/25 bg-gradient-to-br from-[#facc15] to-amber-400 p-6 text-[#0f172a] shadow-xl shadow-amber-500/10">
            <h4 className="text-xl font-bold">{t("dashboard.tipsTitle")}</h4>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm font-medium opacity-95">
              <li>{t("dashboard.tip1")}</li>
              <li>{t("dashboard.tip2")}</li>
              <li>{t("dashboard.tip3")}</li>
            </ul>
            <a
              href="/pricing"
              className="mt-5 inline-block rounded-full bg-[#0f172a] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-zinc-900"
            >
              {t("dashboard.viewPlans")}
            </a>
          </div>
        </aside>
      </div>

      <section className="mt-10 rounded-3xl border border-white/[0.07] bg-[#0d1420] p-5 sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">{t("dashboard.recentTitle")}</h3>
            <p className="mt-1 text-sm text-zinc-500">{t("dashboard.recentSub")}</p>
          </div>
          <a
            href="/history"
            className="text-sm font-semibold text-[#7dd3fc] hover:text-[#facc15] hover:underline"
          >
            {t("dashboard.viewHistory")}
          </a>
        </div>
        {loading ? (
          <p className="mt-6 text-sm text-zinc-400">{t("dashboard.loading")}</p>
        ) : jobs.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center text-sm text-zinc-500">
            {t("dashboard.noJobs")}
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {jobs.slice(0, 6).map((job) => (
              <JobCard key={job.id} job={job} variant="compact" />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
