import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  // Not used for now; we keep the parameter for consistent Next.js handler signature.
  void _req;
  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    priority: "high",
    expires: new Date(0),
  });
  return res;
}

