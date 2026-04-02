import Link from "next/link";

export function AuthSiteFooter() {
  return (
    <footer className="relative z-10 mx-auto mt-10 w-full max-w-md border-t border-white/10 py-6 text-center text-[13px] text-zinc-400">
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Link className="text-zinc-300 hover:text-white hover:underline" href="/terms">
          Terms of Service
        </Link>
        <span aria-hidden className="text-zinc-600">
          ·
        </span>
        <Link className="text-zinc-300 hover:text-white hover:underline" href="/privacy">
          Privacy
        </Link>
        <span aria-hidden className="text-zinc-600">
          ·
        </span>
        <Link className="text-zinc-300 hover:text-white hover:underline" href="/contact">
          Contact
        </Link>
      </nav>
      <p className="mt-3 text-zinc-500">
        © {new Date().getFullYear()} Fayda ID Card Converter. For Ethiopian digital ID holders.
      </p>
    </footer>
  );
}
