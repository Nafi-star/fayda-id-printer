import { NextRequest, NextResponse } from "next/server";

import { createPasswordReset } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { email?: string };
  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json({ message: "Email is required." }, { status: 400 });
  }

  const result = await createPasswordReset(email);

  // For v1 dev UX: return token so you can test the reset flow.
  // In production, do not return token; send it by email.
  return NextResponse.json({
    ok: true,
    token: result.tokenForDebug,
  });
}

