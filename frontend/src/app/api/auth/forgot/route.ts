import { NextRequest, NextResponse } from "next/server";

import { createPasswordReset } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { email?: string };
  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json({ message: "Email is required." }, { status: 400 });
  }

  const result = await createPasswordReset(email);

  const isDev = process.env.NODE_ENV !== "production";
  return NextResponse.json({
    ok: true,
    message: "If an account exists for this email, check for reset instructions.",
    ...(isDev ? { token: result.tokenForDebug } : {}),
  });
}

