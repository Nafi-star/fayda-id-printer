import Link from "next/link";

import { AuthPageFrame } from "@/components/auth-page-frame";

export const metadata = {
  title: "Privacy Policy | Fayda ID Card Converter",
};

export default function PrivacyPage() {
  return (
    <AuthPageFrame>
      <article className="max-h-[70vh] overflow-y-auto rounded-sm bg-white px-6 py-8 shadow-2xl">
        <h1 className="text-xl font-bold text-zinc-800">Privacy Policy</h1>
        <p className="mt-2 text-sm text-zinc-600">Last updated: March 2026</p>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-700">
          <p>
            We collect the minimum data needed to run Fayda ID Card Converter: your email and password for account
            access, and the files you upload for conversion.
          </p>
          <p>
            <strong>Processing.</strong> Conversion runs on servers you connect to when using this product. Files are
            processed to produce a single print-ready image and are not used for unrelated purposes.
          </p>
          <p>
            <strong>Retention.</strong> As described in our Terms, uploads and generated outputs are removed after
            download or within 24 hours. Account records (email, password hash) remain until you ask for deletion or
            close your account, except where law requires logs.
          </p>
          <p>
            <strong>Security.</strong> Passwords are stored hashed. Use a unique password and enable password reset if
            you suspect access issues.
          </p>
          <p>
            <strong>Children.</strong> This Service is intended for adults holding National ID credentials. Do not
            upload children&apos;s documents without legal authority.
          </p>
        </div>
        <p className="mt-8 text-center text-sm">
          <Link href="/terms" className="font-semibold text-blue-600 hover:underline">
            Terms of Service
          </Link>
          {" · "}
          <Link href="/login" className="font-semibold text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </article>
    </AuthPageFrame>
  );
}
