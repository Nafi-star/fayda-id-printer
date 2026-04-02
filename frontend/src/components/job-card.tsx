"use client";

import { friendlyFileName, fileKindFromName } from "@/lib/job-display";
import { useI18n } from "@/i18n/context";

export type JobCardModel = {
  id: string;
  input_file_key: string;
  status: string;
  created_at: string;
  output_file_key?: string | null;
  error_message?: string | null;
};

function FileGlyph({ kind }: { kind: "pdf" | "image" | "other" }) {
  if (kind === "pdf") {
    return (
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-500/15 text-lg text-red-300 ring-1 ring-red-400/25">
        PDF
      </span>
    );
  }
  if (kind === "image") {
    return (
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-lg ring-1 ring-emerald-400/25">
        🖼
      </span>
    );
  }
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-zinc-500/20 text-zinc-400 ring-1 ring-white/10">
      📄
    </span>
  );
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const s = status.toLowerCase();
  const styles =
    s === "completed"
      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
      : s === "failed"
        ? "bg-red-500/15 text-red-300 ring-red-400/30"
        : s === "processing" || s === "queued"
          ? "bg-amber-500/15 text-amber-200 ring-amber-400/35 animate-pulse"
          : "bg-zinc-500/20 text-zinc-300 ring-white/10";

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ${styles}`}
    >
      {label}
    </span>
  );
}

function formatWhen(iso: string, localeCode: string) {
  const d = new Date(iso);
  return d.toLocaleString(localeCode === "am" ? "am-ET" : undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(status: string, t: (k: string) => string) {
  const s = status.toLowerCase();
  if (s === "completed") return t("jobCard.statusCompleted");
  if (s === "failed") return t("jobCard.statusFailed");
  if (s === "queued") return t("jobCard.statusQueued");
  if (s === "processing") return t("jobCard.statusProcessing");
  return status;
}

export function JobCard({ job, variant = "default" }: { job: JobCardModel; variant?: "default" | "compact" }) {
  const { t, locale } = useI18n();
  const name = friendlyFileName(job.input_file_key);
  const kind = fileKindFromName(name);
  const shortId = job.id.slice(0, 8);

  const pad = variant === "compact" ? "p-4" : "p-5 sm:p-6";

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#1a2332] to-[#141c2b] shadow-lg shadow-black/20 ${pad} transition hover:border-[#facc15]/25 hover:shadow-[#facc15]/5`}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#facc15]/5 blur-2xl transition group-hover:bg-[#facc15]/10" />
      <div className={`relative flex gap-4 ${variant === "compact" ? "flex-col sm:flex-row sm:items-center" : "flex-col sm:flex-row sm:items-center"}`}>
        <FileGlyph kind={kind} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-zinc-100" title={name}>
            {name}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
            <span>{formatWhen(job.created_at, locale)}</span>
            <span className="text-zinc-600">·</span>
            <span className="font-mono text-[10px] text-zinc-600">#{shortId}</span>
          </p>
          {job.status === "failed" && job.error_message ? (
            <p className="mt-2 line-clamp-2 text-xs text-red-300/90">{job.error_message}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <StatusPill status={job.status} label={statusLabel(job.status, t)} />
          <div className="flex flex-wrap gap-2">
            {job.status === "completed" ? (
              <>
                <a
                  href={`/api/jobs/${job.id}/download?inline=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-white"
                >
                  <svg className="h-3.5 w-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {t("jobCard.preview")}
                </a>
                <a
                  href={`/api/jobs/${job.id}/download`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#facc15] px-4 py-2 text-xs font-bold text-[#0f172a] shadow-md shadow-yellow-500/20 transition hover:bg-[#fde047]"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t("jobCard.downloadPng")}
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
