import { NextRequest, NextResponse } from "next/server";

import { registerUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { email?: string; password?: string };
  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ message: "Password must be at least 4 characters." }, { status: 400 });
  }

  const result = await registerUser(email, password);
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    pendingApproval: result.accountStatus === "pending",
  });
}

