import { NextRequest, NextResponse } from "next/server";

import { getUserFromSession } from "@/lib/auth";
import { db, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ jobId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const token = req.cookies.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  await ensureSchema();

  const result = await db.query(
    `
    SELECT id, user_id, input_file_key, input_file_keys, output_file_key, status, error_message, created_at, updated_at
    FROM jobs
    WHERE id = $1 AND user_id = $2
    `,
    [jobId, user.id],
  );

  const job = result.rows[0] as
    | { input_file_key?: string | null }
    | undefined;
  if (!job) return NextResponse.json({ message: "Job not found." }, { status: 404 });
  if (job.input_file_key === "[purged]") {
    return NextResponse.json({ message: "This conversion has expired (files removed after 24 hours)." }, { status: 404 });
  }

  return NextResponse.json({ job });
}
