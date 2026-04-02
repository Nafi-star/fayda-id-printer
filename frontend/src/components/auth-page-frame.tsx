import { AuthSiteFooter } from "@/components/auth-site-footer";
import { LanguageSwitch } from "@/components/language-switch";

export function AuthPageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10 text-zinc-900">
      <div className="pointer-events-none absolute inset-0 bg-[#020617]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background: `
            radial-gradient(ellipse 85% 65% at 50% 42%, rgba(56, 189, 248, 0.35) 0%, transparent 55%),
            radial-gradient(circle at 22% 58%, rgba(37, 99, 235, 0.22) 0%, transparent 42%),
            radial-gradient(circle at 78% 55%, rgba(59, 130, 246, 0.2) 0%, transparent 40%)
          `,
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,transparent_0%,rgba(2,6,23,0.88)_72%)]" />
      <div className="relative z-10 flex w-full max-w-md flex-col items-stretch">
        {children}
        <div className="mt-8 flex justify-center">
          <LanguageSwitch />
        </div>
        <AuthSiteFooter />
      </div>
    </div>
  );
}
