"use client";

import Link from "next/link";

import { LogoMark } from "@/components/brand-logo";
import { useI18n } from "@/i18n/context";

export function DashboardFooter() {
  const { t } = useI18n();

  return (
    <footer className="mt-16 border-t border-white/10 py-10 text-center text-[13px] text-zinc-500">
      <div className="mb-4 flex justify-center opacity-80">
        <LogoMark className="h-8 w-8" />
      </div>
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Link href="/terms" className="hover:text-zinc-300 hover:underline">
          {t("footer.terms")}
        </Link>
        <span className="text-zinc-700">·</span>
        <Link href="/privacy" className="hover:text-zinc-300 hover:underline">
          {t("footer.privacy")}
        </Link>
        <span className="text-zinc-700">·</span>
        <Link href="/contact" className="hover:text-zinc-300 hover:underline">
          {t("footer.contact")}
        </Link>
      </nav>
      <p className="mt-3">
        © {new Date().getFullYear()} {t("footer.copyright")}
      </p>
    </footer>
  );
}
