import { NextRequest, NextResponse } from "next/server";

import { isAdminEmail, normalizedAdminEmails } from "@/lib/admin-config";
import { ensureAuthSchema, getUserFromSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await ensureAuthSchema();
  const admins = normalizedAdminEmails();
  const result = await db.query(
    `
    SELECT id, email, account_status, created_at
    FROM users
    WHERE NOT (LOWER(TRIM(email)) = ANY($1::text[]))
    ORDER BY created_at DESC
    `,
    [admins],
  );

  return NextResponse.json({ users: result.rows });
}
