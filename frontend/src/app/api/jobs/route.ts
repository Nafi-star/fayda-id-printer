import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { db, ensureSchema } from "@/lib/db";
import { getUserFromSession } from "@/lib/auth";
import { countUserConversions, getFreeTrialConversionLimit } from "@/lib/free-trial";
import { pushConversionJob } from "@/lib/queue";

type CreateJobBody = {
  inputFileKey: string;
  colorMode?: "color" | "bw";
};

export async function GET(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  await ensureSchema();
  const result = await db.query(
    `
    SELECT id, user_id, input_file_key, output_file_key, status, error_message, created_at, updated_at
    FROM jobs
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 50
    `,
    [user.id],
  );

  return NextResponse.json({ jobs: result.rows });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<CreateJobBody>;
  if (!body.inputFileKey) {
    return NextResponse.json(
      { message: "inputFileKey is required." },
      { status: 400 },
    );
  }

  const token = req.cookies.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  await ensureSchema();

  const trialLimit = getFreeTrialConversionLimit();
  if (trialLimit !== null) {
    const used = await countUserConversions(user.id);
    if (used >= trialLimit) {
      return NextResponse.json(
        {
          message: `Your free trial includes ${trialLimit} conversion${trialLimit === 1 ? "" : "s"}. Paid plans will unlock more — thank you for trying Fayda ID Card Converter.`,
          code: "FREE_TRIAL_EXHAUSTED",
        },
        { status: 403 },
      );
    }
  }

  const jobId = randomUUID();
  await db.query(
    `
    INSERT INTO jobs (id, user_id, input_file_key, status)
    VALUES ($1, $2, $3, 'queued')
    `,
    [jobId, user.id, body.inputFileKey],
  );

  const colorMode = body.colorMode === "bw" ? "bw" : "color";

  try {
    await pushConversionJob({
      job_id: jobId,
      user_id: user.id,
      input_file_key: body.inputFileKey,
      output_prefix: `users/${user.id}/outputs`,
      color_mode: colorMode,
    });
  } catch (err) {
    const hint =
      "Could not reach the job queue. From the project root run: docker compose up -d redis   " +
      "and ensure REDIS_URL in frontend/.env.local is redis://127.0.0.1:6379/0";
    const detail = err instanceof Error ? err.message : String(err);
    await db.query(
      `
      UPDATE jobs
      SET status = 'failed', error_message = $2, updated_at = NOW()
      WHERE id = $1
      `,
      [jobId, `${hint} (${detail})`],
    );
    return NextResponse.json({ message: hint, code: "QUEUE_UNAVAILABLE" }, { status: 503 });
  }

  return NextResponse.json({ jobId, status: "queued" }, { status: 201 });
}
