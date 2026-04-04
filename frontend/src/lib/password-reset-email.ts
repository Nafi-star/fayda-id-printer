import nodemailer from "nodemailer";

export type SendPasswordResetResult = { ok: true } | { ok: false; reason: string };

/**
 * Send password reset link. Configure one of:
 * - RESEND_API_KEY + EMAIL_FROM (https://resend.com) — easiest for production
 * - Gmail: SMTP_SERVICE=gmail, SMTP_USER=you@gmail.com, SMTP_PASSWORD=app-password, EMAIL_FROM=you@gmail.com
 * - Any SMTP: SMTP_HOST, SMTP_PORT, EMAIL_FROM, and usually SMTP_USER + SMTP_PASSWORD
 */
export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
): Promise<SendPasswordResetResult> {
  const subject = "Reset your password";
  const text = `Reset your password using this link (expires in 30 minutes):\n\n${resetLink}\n\nIf you did not request this, ignore this email.`;
  const html = `
    <p>You requested a password reset for your account.</p>
    <p><a href="${resetLink}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Set new password</a></p>
    <p style="font-size:12px;color:#666;">Or copy this link: ${resetLink}</p>
    <p style="font-size:12px;color:#666;">This link expires in 30 minutes. If you did not request a reset, you can ignore this email.</p>
  `.trim();

  const resend = await tryResend(to, subject, html, text);
  if (resend.outcome === "sent") return { ok: true };
  const smtp = await trySmtp(to, subject, html, text);
  if (smtp.outcome === "sent") return { ok: true };

  const parts = [resend.reason, smtp.reason].filter(Boolean);
  return { ok: false, reason: parts.join(" ") || "No email provider configured." };
}

async function tryResend(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<{ outcome: "sent" | "skipped" | "failed"; reason?: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { outcome: "skipped" };

  const from = process.env.EMAIL_FROM?.trim() || "onboarding@resend.dev";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("Resend email failed:", res.status, err.slice(0, 500));
      return { outcome: "failed", reason: `Resend: ${res.status}` };
    }
    return { outcome: "sent" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Resend request error:", e);
    return { outcome: "failed", reason: `Resend: ${msg}` };
  }
}

async function trySmtp(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<{ outcome: "sent" | "skipped" | "failed"; reason?: string }> {
  const from = process.env.EMAIL_FROM?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  const host = process.env.SMTP_HOST?.trim();
  const service = process.env.SMTP_SERVICE?.trim().toLowerCase();

  const useGmail =
    service === "gmail" || host === "smtp.gmail.com" || host === "smtp.googlemail.com";

  if (useGmail) {
    if (!user || !pass || !from) {
      return {
        outcome: "skipped",
        reason: "Gmail needs SMTP_USER, SMTP_PASSWORD (app password), and EMAIL_FROM.",
      };
    }
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
      });
      await transporter.sendMail({ from, to, subject, text, html });
      return { outcome: "sent" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Gmail SMTP failed:", e);
      return {
        outcome: "failed",
        reason: `Gmail: ${msg.slice(0, 200)}`,
      };
    }
  }

  if (!host || !from) return { outcome: "skipped" };

  const port = Number.parseInt(process.env.SMTP_PORT?.trim() || "587", 10);
  const secure = (process.env.SMTP_SECURE?.trim() || "").toLowerCase() === "true" || port === 465;

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      requireTLS: !secure && port === 587,
    });
    await transporter.sendMail({ from, to, subject, text, html });
    return { outcome: "sent" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("SMTP send failed:", e);
    return { outcome: "failed", reason: `SMTP: ${msg.slice(0, 200)}` };
  }
}
