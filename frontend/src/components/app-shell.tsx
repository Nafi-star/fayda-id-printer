"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { DashboardFooter } from "@/components/dashboard-footer";
import { LanguageSwitch } from "@/components/language-switch";
import { useI18n } from "@/i18n/context";

type AppShellProps = {
  active: "convert" | "history" | "pricing" | "purchase-history" | "admin";
  children: React.ReactNode;
  userLabel?: string;
};

export function AppShell({ active, children, userLabel = "S7" }: AppShellProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const mainNav: Array<{ id: AppShellProps["active"]; label: string; href: string; brand?: boolean }> = [
    { id: "convert", label: "", href: "/dashboard", brand: true },
    { id: "history", label: t("nav.history"), href: "/history" },
    { id: "pricing", label: t("nav.pricing"), href: "/pricing" },
    { id: "purchase-history", label: t("nav.purchaseHistory"), href: "/purchase-history" },
    ...(isAdmin ? [{ id: "admin" as const, label: t("nav.admin"), href: "/admin" }] : []),
  ];

  useEffect(() => {
    void fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { isAdmin?: boolean }) => setIsAdmin(Boolean(d.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
  }

  function go(path: string) {
    setMenuOpen(false);
    router.push(path);
  }

  useEffect(() => {
    function onDocPointer(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0B1120] text-white">
      <header className="border-b border-white/5 bg-[#0B1120]/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-14 w-full max-w-[1200px] items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium sm:gap-x-8">
            {mainNav.map((item) => {
              const isActive = active === item.id;
              if (item.brand) {
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    className={`inline-flex items-center border-b-2 pb-1 transition-colors ${
                      isActive ? "border-[#FFC107]" : "border-transparent opacity-95 hover:opacity-100"
                    }`}
                  >
                    <BrandLogo size="sm" line2={t("nav.brandLine2")} />
                  </a>
                );
              }
              return (
                <a
                  key={item.id}
                  href={item.href}
                  className={`border-b-2 pb-1 transition-colors ${
                    isActive ? "border-[#FFC107] text-[#FFC107]" : "border-transparent text-zinc-200 hover:text-white"
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <LanguageSwitch />
            <button
              type="button"
              aria-label={t("nav.notifications")}
              className="hidden text-white/90 hover:text-white sm:block"
            >
              <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.082A2 2 0 0021 15.5V12a9 9 0 10-18 0v3.5a2 2 0 001.689 1.98"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 19.5a2.5 2.5 0 005 0" />
              </svg>
            </button>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                title={t("nav.signOut")}
                onClick={() => setMenuOpen((s) => !s)}
                className="grid h-9 w-9 place-items-center rounded-full bg-[#1d4ed8] text-xs font-semibold text-white ring-2 ring-white/10 hover:bg-[#2563eb] sm:h-10 sm:w-10 sm:text-sm"
              >
                {userLabel.slice(0, 2).toUpperCase()}
              </button>
              {menuOpen ? (
                <div className="absolute right-0 z-[70] mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#0e1625] p-1 shadow-2xl ring-1 ring-black/30">
                  <button
                    type="button"
                    onClick={() => go("/dashboard")}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                  >
                    Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => go("/history")}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                  >
                    {t("nav.history")}
                  </button>
                  <button
                    type="button"
                    onClick={() => go("/pricing")}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                  >
                    {t("nav.pricing")}
                  </button>
                  <button
                    type="button"
                    onClick={() => go("/purchase-history")}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                  >
                    {t("nav.purchaseHistory")}
                  </button>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => go("/admin")}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-amber-200 hover:bg-white/10"
                    >
                      {t("nav.admin")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      await logout();
                    }}
                    className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-300 hover:bg-red-500/15"
                  >
                    {t("nav.signOut")}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-cyan-950/30 bg-gradient-to-r from-cyan-950/20 via-transparent to-cyan-950/20 px-4 pt-2 pb-2 sm:px-6">
        <div className="mx-auto flex max-w-[1200px] items-start gap-2 rounded-lg border border-cyan-300/40 bg-[#d5f5f6]/95 px-2.5 py-1.5 text-[11px] leading-snug text-[#0c4a6e] shadow-sm backdrop-blur-sm sm:items-center sm:gap-2.5 sm:px-3 sm:py-2 sm:text-xs">
          <span className="select-none text-sm opacity-90" aria-hidden>
            📢
          </span>
          <p className="min-w-0 flex-1 text-pretty sm:truncate">{t("banner.compact")}</p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
        {children}
        <DashboardFooter />
      </main>
    </div>
  );
}
