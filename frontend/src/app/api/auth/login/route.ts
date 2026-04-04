import { NextRequest, NextResponse } from "next/server";

import { checkAndTrackLoginRateLimit, clearLoginRateLimit } from "@/lib/auth-rate-limit";
import { loginUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { email?: string; password?: string };
  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-ip";
  const limiterKey = `${ip}:${email.toLowerCase()}`;
  const rate = checkAndTrackLoginRateLimit(limiterKey);
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      },
    );
  }

  const result = await loginUser(email, password);
  if (!result.ok) {
    const code = "code" in result ? result.code : undefined;
    const status =
      code === "PENDING_APPROVAL" || code === "ACCOUNT_DISABLED" ? 403 : 401;
    return NextResponse.json({ message: result.message, code }, { status });
  }
  clearLoginRateLimit(limiterKey);

  const secure = process.env.NODE_ENV === "production";
  const isDev = process.env.NODE_ENV !== "production";
  const res = NextResponse.json({
    ok: true,
    sessionToken: isDev ? result.sessionToken : undefined,
  });
  res.cookies.set("session", result.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    priority: "high",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}

