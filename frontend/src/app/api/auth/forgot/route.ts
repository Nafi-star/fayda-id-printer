import { NextRequest, NextResponse } from "next/server";

import { getAppBaseUrl } from "@/lib/app-url";
import { createPasswordReset } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/password-reset-email";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { email?: string };
  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json({ message: "Email is required." }, { status: 400 });
  }

  const result = await createPasswordReset(email);

  let emailDelivered = false;
  let sendDetail: string | undefined;
  if (result.resetToken) {
    const link = `${getAppBaseUrl()}/reset?token=${encodeURIComponent(result.resetToken)}`;
    const send = await sendPasswordResetEmail(email, link);
    emailDelivered = send.ok;
    if (!send.ok) sendDetail = send.reason;
  }

  const isDev = process.env.NODE_ENV !== "production";
  const hasMailConfig =
    Boolean(process.env.RESEND_API_KEY?.trim()) ||
    Boolean(process.env.SMTP_SERVICE?.trim() === "gmail" && process.env.SMTP_USER?.trim()) ||
    Boolean(process.env.SMTP_HOST?.trim() && process.env.EMAIL_FROM?.trim());

  const message = emailDelivered
    ? "If an account exists for this email, we sent a reset link. Check your inbox (and spam)."
    : hasMailConfig && result.resetToken
      ? "If an account exists for this email, we could not send email. Check server logs and SMTP/Resend settings."
      : "If an account exists for this email, you will receive reset instructions after you configure Resend or SMTP (see deployment docs).";

  return NextResponse.json({
    ok: true,
    message,
    emailDelivered,
    ...(isDev && result.resetToken
      ? {
          devResetLink: `${getAppBaseUrl()}/reset?token=${encodeURIComponent(result.resetToken)}`,
          ...(sendDetail ? { emailDebug: sendDetail } : {}),
        }
      : {}),
  });
}

