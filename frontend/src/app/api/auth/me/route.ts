import { NextRequest, NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/admin-config";
import { getUserFromSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) {
    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      { user: null, isAdmin: false, tokenSeen: isDev ? token ?? null : undefined },
      { status: 200 },
    );
  }
  return NextResponse.json({ user, isAdmin: isAdminEmail(user.email) });
}

