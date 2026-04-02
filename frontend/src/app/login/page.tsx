import { Suspense } from "react";

import { AuthPageFrame } from "@/components/auth-page-frame";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthPageFrame>
          <div className="mx-auto h-96 max-w-md animate-pulse rounded-sm bg-white/90 shadow-2xl" />
        </AuthPageFrame>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
