import { NextRequest, NextResponse } from "next/server";

import { db, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

type JobUpdateBody = {
  jobId: string;
  status: "processing" | "completed" | "failed";
  outputFileKey?: string;
  errorMessage?: string;
};

/** Matches worker default when .env is not set — see worker/app/config.py */
const DEV_WORKER_TOKEN_FALLBACK = "dev-shared-token-change-me";

function expectedWorkerTokens(): string[] {
  const fromEnv = process.env.WORKER_CALLBACK_TOKEN?.trim();
  if (fromEnv) return [fromEnv];
  if (process.env.NODE_ENV !== "production") return [DEV_WORKER_TOKEN_FALLBACK];
  return [];
}

function isAuthorized(req: NextRequest) {
  const expected = expectedWorkerTokens();
  if (expected.length === 0) return false;
  const got = req.headers.get("x-worker-token");
  return got != null && expected.includes(got);
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
