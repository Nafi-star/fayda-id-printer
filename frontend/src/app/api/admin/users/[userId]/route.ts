import { NextRequest, NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/admin-config";
import type { AccountStatus } from "@/lib/auth";
import { ensureAuthSchema, getUserFromSession } from "@/lib/auth";
import { db } from "@/lib/db";

type PatchBody = { accountStatus?: AccountStatus };

type RouteParams = { params: Promise<{ userId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const token = req.cookies.get("session")?.value;
  const adminUser = await getUserFromSession(token);
  if (!adminUser || !isAdminEmail(adminUser.email)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ message: "Missing user id." }, { status: 400 });
  }

  const body = (await req.json()) as PatchBody;
  const nextStatus = body.accountStatus;
  if (nextStatus !== "active" && nextStatus !== "pending" && nextStatus !== "disabled") {
    return NextResponse.json(
      { message: "accountStatus must be active, pending, or disabled." },
      { status: 400 },
    );
  }

  if (userId === adminUser.id && nextStatus !== "active") {
    return NextResponse.json(
      { message: "You cannot demote or disable your own admin account." },
      { status: 400 },
    );
  }

  await ensureAuthSchema();

  const target = await db.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [userId]);
  const targetRow = target.rows[0]?.email;
  if (targetRow && isAdminEmail(targetRow)) {
    return NextResponse.json(
      { message: "The administrator account cannot be changed from this panel." },
      { status: 400 },
    );
  }
  const updated = await db.query(
    `UPDATE users SET account_status = $1 WHERE id = $2 RETURNING id, email, account_status, created_at`,
    [nextStatus, userId],
  );

  if (updated.rows.length === 0) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  if (nextStatus !== "active") {
    await db.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
  }

  return NextResponse.json({ user: updated.rows[0] });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const token = req.cookies.get("session")?.value;
  const adminUser = await getUserFromSession(token);
  if (!adminUser || !isAdminEmail(adminUser.email)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ message: "Missing user id." }, { status: 400 });
  }

  if (userId === adminUser.id) {
    return NextResponse.json({ message: "You cannot delete your own account." }, { status: 400 });
  }

  await ensureAuthSchema();

  const delTarget = await db.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [userId]);
  const delRow = delTarget.rows[0]?.email;
  if (delRow && isAdminEmail(delRow)) {
    return NextResponse.json(
      { message: "The administrator account cannot be deleted." },
      { status: 400 },
    );
  }

  await db.query(`DELETE FROM jobs WHERE user_id = $1`, [userId]);
  const del = await db.query(`DELETE FROM users WHERE id = $1 RETURNING id`, [userId]);
  if (del.rows.length === 0) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
