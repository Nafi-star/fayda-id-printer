import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { db, ensureSchema } from "@/lib/db";
import { pushConversionJob } from "@/lib/queue";

type CreateJobBody = {
  userId: string;
  inputFileKey: string;
};

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json(
      { message: "userId query param is required." },
      { status: 400 },
    );
  }

  await ensureSchema();
  const result = await db.query(
    `
    SELECT id, user_id, input_file_key, output_file_key, status, error_message, created_at, updated_at
    FROM jobs
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 50
    `,
    [userId],
  );

  return NextResponse.json({ jobs: result.rows });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<CreateJobBody>;
  if (!body.userId || !body.inputFileKey) {
    return NextResponse.json(
      { message: "userId and inputFileKey are required." },
      { status: 400 },
    );
  }

  await ensureSchema();

  const jobId = randomUUID();
  await db.query(
    `
    INSERT INTO jobs (id, user_id, input_file_key, status)
    VALUES ($1, $2, $3, 'queued')
    `,
    [jobId, body.userId, body.inputFileKey],
  );

  await pushConversionJob({
    job_id: jobId,
    user_id: body.userId,
    input_file_key: body.inputFileKey,
    output_prefix: `users/${body.userId}/outputs`,
  });

  return NextResponse.json({ jobId, status: "queued" }, { status: 201 });
}
