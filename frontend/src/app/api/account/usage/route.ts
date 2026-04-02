import { NextRequest, NextResponse } from "next/server";

import { getUserFromSession } from "@/lib/auth";
import { countUserConversions, getFreeTrialConversionLimit } from "@/lib/free-trial";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const limit = getFreeTrialConversionLimit();
  const conversionsUsed = await countUserConversions(user.id);
  const remaining = limit === null ? null : Math.max(0, limit - conversionsUsed);

  return NextResponse.json({
    conversionsUsed,
    freeTrialLimit: limit,
    remaining,
    isUnlimited: limit === null,
  });
}
