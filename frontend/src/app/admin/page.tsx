"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { useI18n } from "@/i18n/context";

type Row = {
  id: string;
  email: string;
  account_status: string;
  created_at: string;
};

function statusLabel(
  s: string,
  t: (k: string) => string,
): { text: string; className: string } {
  if (s === "pending") return { text: t("adminPage.pending"), className: "text-amber-300" };
  if (s === "disabled") return { text: t("adminPage.disabled"), className: "text-red-300" };
  return { text: t("adminPage.active"), className: "text-emerald-300" };
}

export default function AdminPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [users, setUsers] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const pendingCount = users.filter((u) => u.account_status === "pending").length;

  const load = useCallback(async () => {
    setError(null);
    const meRes = await fetch("/api/auth/me", { credentials: "include" });
    const me = (await meRes.json()) as { user: { id: string } | null; isAdmin?: boolean };
    if (!meRes.ok || !me.user) {
      setLoading(false);
      router.replace("/login");
      return;
    }
    if (!me.isAdmin) {
      setError(t("adminPage.forbidden"));
      setLoading(false);
      return;
    }

    const res = await fetch("/api/admin/users", { credentials: "include" });
    if (!res.ok) {
      setError(t("adminPage.loadError"));
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { users: Row[] };
    setUsers(data.users ?? []);
    setLoading(false);
  }, [router, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchStatus(userId: string, accountStatus: "active" | "pending" | "disabled") {
    setBusyId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountStatus }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? t("adminPage.loadError"));
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function removeUser(userId: string) {
    if (!window.confirm(t("adminPage.confirmRemove"))) return;
    setBusyId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? t("adminPage.loadError"));
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!loading && error === t("adminPage.forbidden")) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B1120] px-4 text-center text-zinc-300">
        <p className="mb-4">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="rounded-lg bg-[#1d4ed8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2563eb]"
        >
          Dashboard
        </button>
      </div>
    );
  }

  return (
    <AppShell active="admin" userLabel="AD">
      <div className="relative">
        <header className="relative mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
                {t("adminPage.badge")}
              </span>
              {!loading && pendingCount > 0 ? (
                <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-100">
                  {pendingCount} {t("adminPage.pendingBadge")}
                </span>
              ) : null}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t("adminPage.title")}</h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-400">{t("adminPage.subtitle")}</p>
          </div>
          <button
            type="button"
            disabled={loading || refreshing}
            onClick={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
            className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/10 disabled:opacity-50"
          >
            {refreshing ? "…" : t("adminPage.refresh")}
          </button>
        </header>

        {error && error !== t("adminPage.forbidden") ? (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0e1625] shadow-xl">
          {loading ? (
            <p className="p-8 text-center text-sm text-zinc-400">{t("dashboard.loading")}</p>
          ) : users.length === 0 ? (
            <p className="p-8 text-center text-sm text-zinc-400">{t("adminPage.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03] text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">{t("adminPage.email")}</th>
                    <th className="px-4 py-3">{t("adminPage.status")}</th>
                    <th className="px-4 py-3">{t("adminPage.joined")}</th>
                    <th className="px-4 py-3 text-right">{t("adminPage.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u) => {
                    const st = statusLabel(u.account_status, t);
                    const busy = busyId === u.id;
                    return (
                      <tr key={u.id} className="text-zinc-200">
                        <td className="px-4 py-3 font-medium text-white">{u.email}</td>
                        <td className={`px-4 py-3 ${st.className}`}>{st.text}</td>
                        <td className="px-4 py-3 text-zinc-500">
                          {new Date(u.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            {u.account_status === "pending" ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void patchStatus(u.id, "active")}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                              >
                                {t("adminPage.approve")}
                              </button>
                            ) : null}
                            {u.account_status === "active" ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void patchStatus(u.id, "disabled")}
                                className="rounded-lg bg-zinc-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-600 disabled:opacity-50"
                              >
                                {t("adminPage.disable")}
                              </button>
                            ) : null}
                            {u.account_status === "disabled" ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void patchStatus(u.id, "active")}
                                className="rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                              >
                                {t("adminPage.reactivate")}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void removeUser(u.id)}
                              className="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                            >
                              {t("adminPage.remove")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
