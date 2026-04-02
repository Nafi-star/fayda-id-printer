/**
 * Fayda ID Card Converter — brand mark + optional wordmark.
 * Colors: Ethiopian-inspired accent (green · gold · red) + deep slate card.
 */

export function LogoMark({ className = "h-10 w-10", withRing = true }: { className?: string; withRing?: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {withRing ? (
        <rect x="1" y="1" width="38" height="38" rx="12" className="fill-[#0f172a] stroke-[#facc15]/90" strokeWidth="2" />
      ) : (
        <rect x="1" y="1" width="38" height="38" rx="12" className="fill-[#0f172a]" />
      )}
      {/* subtle tricolor hint */}
      <path d="M8 28h24" stroke="url(#flag)" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
      <defs>
        <linearGradient id="flag" x1="8" y1="28" x2="32" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#078930" />
          <stop offset="0.5" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#da121a" />
        </linearGradient>
      </defs>
      {/* ID card face */}
      <rect x="9" y="8" width="22" height="16" rx="2.5" fill="#1e293b" stroke="#64748b" strokeWidth="0.75" />
      <circle cx="15" cy="14" r="3" fill="#94a3b8" />
      <path d="M21 12h7M21 15h5M21 18h6" stroke="#64748b" strokeWidth="0.9" strokeLinecap="round" />
      {/* conversion arrow */}
      <path d="M12 26l6-3 2 4" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 26H16" stroke="#facc15" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function BrandLogo({
  size = "md",
  showText = true,
  className = "",
  line2 = "ID Card",
}: {
  size?: "sm" | "md";
  showText?: boolean;
  className?: string;
  /** Second line under “Fayda” (e.g. “Convertor” in the top nav). */
  line2?: string;
}) {
  const iconClass = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const titleClass = size === "sm" ? "text-sm" : "text-[0.95rem]";

  if (!showText) {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <LogoMark className={iconClass} />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={iconClass} />
      <span className={`flex flex-col leading-tight ${titleClass}`}>
        <span className="font-bold tracking-tight text-[#facc15]">Fayda</span>
        <span className="-mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">{line2}</span>
      </span>
    </span>
  );
}

/** Compact circle used on login/register (matches mark aesthetic). */
export function AuthBrandBadge({ className = "" }: { className?: string }) {
  return (
    <div
      className={`grid place-items-center rounded-full border-2 border-[#facc15]/80 bg-[#0f172a] p-1.5 shadow-lg shadow-cyan-500/10 ${className}`}
      aria-hidden
    >
      <LogoMark className="h-11 w-11" withRing={false} />
    </div>
  );
}
