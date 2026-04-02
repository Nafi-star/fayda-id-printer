import Link from "next/link";

import { AuthPageFrame } from "@/components/auth-page-frame";

export const metadata = {
  title: "Terms of Service | Fayda ID Card Converter",
  description: "Terms governing use of the Fayda ID Card Converter service.",
};

export default function TermsPage() {
  return (
    <AuthPageFrame>
      <article className="max-h-[70vh] overflow-y-auto rounded-sm bg-white px-6 py-8 shadow-2xl sm:max-h-[75vh]">
        <h1 className="text-xl font-bold text-zinc-800">Terms of Service</h1>
        <p className="mt-2 text-sm text-zinc-600">Last updated: March 2026</p>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-700">
          <p>
            By using Fayda ID Card Converter (&quot;Service&quot;), you agree to these terms. The Service helps Ethiopian
            users turn official Fayda National ID digital PDFs or clear screenshots into high-resolution, print-ready ID
            card images for personal use.
          </p>
          <h2 className="pt-2 text-base font-semibold text-zinc-900">Eligibility and your data</h2>
          <ul className="list-inside list-disc space-y-2">
            <li>You must own the ID data you upload or have clear authorization to use it.</li>
            <li>Files are processed only to generate your ID card image layout.</li>
            <li>
              Uploaded PDFs and images are treated as confidential. We do not use your ID content for advertising,
              resale, or model training.
            </li>
          </ul>
          <h2 className="pt-2 text-base font-semibold text-zinc-900">Retention and deletion</h2>
          <ul className="list-inside list-disc space-y-2">
            <li>Source uploads and generated outputs are deleted automatically after successful download or after 24 hours, whichever comes first.</li>
            <li>We may run periodic cleanup jobs to remove stale files from storage.</li>
          </ul>
          <h2 className="pt-2 text-base font-semibold text-zinc-900">Prohibited use</h2>
          <ul className="list-inside list-disc space-y-2">
            <li>No fraud, impersonation, or creation of documents for deceptive purposes.</li>
            <li>No reverse-engineering of the Service to extract others&apos; data at scale.</li>
            <li>No unauthorized scraping, resale, or integration as a public API without permission.</li>
          </ul>
          <h2 className="pt-2 text-base font-semibold text-zinc-900">Disclaimer</h2>
          <p>
            The Service is an independent layout tool. It is not affiliated with the official Fayda program. We are
            not liable for legal disputes, immigration, employment, or banking decisions that depend on how you print
            or present your ID. You are responsible for complying with Ethiopian law and institutional requirements.
          </p>
          <h2 className="pt-2 text-base font-semibold text-zinc-900">Contact</h2>
          <p>
            Questions about these terms: see the{" "}
            <Link href="/contact" className="font-medium text-blue-600 hover:underline">
              Contact
            </Link>{" "}
            page.
          </p>
        </div>
        <p className="mt-8 text-center text-sm">
          <Link href="/register" className="font-semibold text-blue-600 hover:underline">
            Back to sign up
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
