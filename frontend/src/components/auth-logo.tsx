import { AuthBrandBadge } from "@/components/brand-logo";

/** Login / register hero mark — matches main site branding. */
export function AuthLogo({ className = "" }: { className?: string }) {
  return <AuthBrandBadge className={className} />;
}
