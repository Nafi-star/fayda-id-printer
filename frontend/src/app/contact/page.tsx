import Link from "next/link";

import { AuthPageFrame } from "@/components/auth-page-frame";

export const metadata = {
  title: "Contact | Fayda ID Card Converter",
};

export default function ContactPage() {
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

  return (
    <AuthPageFrame>
      <div className="rounded-sm bg-white px-8 py-10 shadow-2xl">
        <h1 className="text-center text-xl font-bold text-zinc-800">Contact</h1>
        {support ? (
          <p className="mx-auto mt-6 text-center text-sm text-zinc-700">
            Email us:{" "}
            <a className="font-semibold text-blue-600 hover:underline" href={`mailto:${support}`}>
              {support}
            </a>
          </p>
        ) : (
          <p className="mx-auto mt-4 max-w-sm text-center text-sm leading-relaxed text-zinc-600">
            For support or business inquiries, add{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs">NEXT_PUBLIC_SUPPORT_EMAIL</code> to{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs">.env.local</code> so a mailto link appears here.
          </p>
        )}
        <p className="mt-8 text-center text-sm">
          <Link href="/login" className="font-semibold text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthPageFrame>
  );
}
