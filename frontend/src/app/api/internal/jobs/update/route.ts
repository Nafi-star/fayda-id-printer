import { NextRequest, NextResponse } from "next/server";

import { db, ensureSchema } from "@/lib/db";

type JobUpdateBody = {
  jobId: string;
  status: "processing" | "completed" | "failed";
  outputFileKey?: string;
  errorMessage?: string;
};

function isAuthorized(req: NextRequest) {
  const token = process.env.WORKER_CALLBACK_TOKEN;
  if (!token) {
    return false;
  }
  return req.headers.get("x-worker-token") === token;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Partial<JobUpdateBody>;
  if (!body.jobId || !body.status) {
    return NextResponse.json(
      { message: "jobId and status are required." },
      { status: 400 },
    );
  }

  await ensureSchema();

  await db.query(
    `
    UPDATE jobs
    SET status = $2,
        output_file_key = COALESCE($3, output_file_key),
        error_message = $4,
        updated_at = NOW()
    WHERE id = $1
    `,
    [body.jobId, body.status, body.outputFileKey ?? null, body.errorMessage ?? null],
  );

  return NextResponse.json({ ok: true });
}
