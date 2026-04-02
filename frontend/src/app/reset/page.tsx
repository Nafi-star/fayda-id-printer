import { Suspense } from "react";

import { AuthPageFrame } from "@/components/auth-page-frame";

import { ResetForm } from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthPageFrame>
          <div className="mx-auto h-96 max-w-md animate-pulse rounded-sm bg-white/90 shadow-2xl" />
        </AuthPageFrame>
      }
    >
      <ResetForm />
    </Suspense>
  );
}
