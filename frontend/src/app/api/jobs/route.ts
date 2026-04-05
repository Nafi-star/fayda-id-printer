import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { db, ensureSchema } from "@/lib/db";
import { getUserFromSession } from "@/lib/auth";
import { countUserConversions, getFreeTrialConversionLimit } from "@/lib/free-trial";
import { pushConversionJob } from "@/lib/queue";

/** Vercel → Render direct HTTP conversion (no Redis). Needs Pro or small PDFs on Hobby (10s limit). */
export const maxDuration = 300;

export const dynamic = "force-dynamic";

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
      AND COALESCE(input_file_key, '') <> '[purged]'
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

  const colorMode: "color" | "bw" = body.colorMode === "bw" ? "bw" : "color";
  const outputPrefix = `users/${user.id}/outputs`;

  const workerHttp =
    process.env.WORKER_HTTP_URL?.trim() || process.env.WORKER_BASE_URL?.trim();

  const queuePayload = {
    job_id: jobId,
    user_id: user.id,
    input_file_key: body.inputFileKey,
    output_prefix: outputPrefix,
    color_mode: colorMode,
  };

  if (workerHttp) {
    const token = process.env.WORKER_CALLBACK_TOKEN?.trim();
    if (!token) {
      await db.query(
        `UPDATE jobs SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`,
        [jobId, "WORKER_CALLBACK_TOKEN is not set on the server."],
      );
      return NextResponse.json(
        { message: "Server misconfiguration: WORKER_CALLBACK_TOKEN missing." },
        { status: 500 },
      );
    }
    const base = workerHttp.replace(/\/$/, "");
    const controller = new AbortController();
    const kill = setTimeout(() => controller.abort(), 280_000);
    try {
      const res = await fetch(`${base}/convert/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-worker-token": token,
        },
        body: JSON.stringify(queuePayload),
        signal: controller.signal,
      });
      clearTimeout(kill);
      const text = await res.text();
      if (!res.ok) {
        await db.query(
          `
          UPDATE jobs
          SET status = 'failed', error_message = $2, updated_at = NOW()
          WHERE id = $1
          `,
          [jobId, `Worker HTTP ${res.status}: ${text.slice(0, 2000)}`],
        );
        return NextResponse.json(
          { message: "Conversion worker failed. Check Render logs and WORKER_CALLBACK_TOKEN match.", code: "WORKER_HTTP_ERROR" },
          { status: 502 },
        );
      }
      let result: { status?: string; output_file_key?: string | null; error_message?: string | null };
      try {
        result = JSON.parse(text) as typeof result;
      } catch {
        await db.query(
          `UPDATE jobs SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`,
          [jobId, `Invalid JSON from worker: ${text.slice(0, 500)}`],
        );
        return NextResponse.json({ message: "Invalid response from worker." }, { status: 502 });
      }
      const st = result.status === "failed" ? "failed" : "completed";
      await db.query(
        `
        UPDATE jobs
        SET status = $2,
            output_file_key = $3,
            error_message = $4,
            updated_at = NOW()
        WHERE id = $1
        `,
        [jobId, st, result.output_file_key ?? null, result.error_message ?? null],
      );
      return NextResponse.json({ jobId, status: st }, { status: 201 });
    } catch (err) {
      clearTimeout(kill);
      const detail = err instanceof Error ? err.message : String(err);
      await db.query(
        `
        UPDATE jobs
        SET status = 'failed', error_message = $2, updated_at = NOW()
        WHERE id = $1
        `,
        [jobId, `Worker HTTP unreachable or timed out: ${detail}`],
      );
      return NextResponse.json(
        {
          message:
            "Could not reach the conversion worker. Set WORKER_HTTP_URL (or WORKER_BASE_URL) to your Render URL; ensure the worker is Live and WORKER_CALLBACK_TOKEN matches on Vercel and Render.",
          code: "WORKER_HTTP_UNREACHABLE",
        },
        { status: 503 },
      );
    }
  }

  try {
    await pushConversionJob(queuePayload);
  } catch (err) {
    const hint =
      "Could not reach the job queue. Set WORKER_HTTP_URL to your Render worker URL (recommended), or run Redis and set REDIS_URL. See DEPLOY.md.";
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
