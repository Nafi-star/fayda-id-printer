"use client";

import type { Locale } from "@/i18n/messages";
import { useI18n } from "@/i18n/context";

export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();

  function select(next: Locale) {
    setLocale(next);
  }

  return (
    <div
      className="flex items-center rounded-full border border-white/10 bg-white/5 p-0.5 text-[11px] font-bold shadow-inner"
      role="group"
      aria-label={t("nav.language")}
    >
      <button
        type="button"
        onClick={() => select("en")}
        className={`rounded-full px-2.5 py-1 transition ${
          locale === "en" ? "bg-[#facc15] text-[#0f172a] shadow-sm" : "text-zinc-400 hover:text-white"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => select("am")}
        className={`rounded-full px-2.5 py-1 transition ${
          locale === "am" ? "bg-[#facc15] text-[#0f172a] shadow-sm" : "text-zinc-400 hover:text-white"
        }`}
      >
        አማ
      </button>
    </div>
  );
}
