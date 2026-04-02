import { NextRequest, NextResponse } from "next/server";

import { resetPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { token?: string; password?: string };
  const token = body.token?.trim();
  const password = body.password;

  if (!token || !password) {
    return NextResponse.json({ message: "Token and password are required." }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ message: "Password must be at least 4 characters." }, { status: 400 });
  }

  const result = await resetPassword(token, password);
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

