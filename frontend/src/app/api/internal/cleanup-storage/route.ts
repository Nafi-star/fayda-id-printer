import { NextRequest, NextResponse } from "next/server";

import { db, ensureSchema } from "@/lib/db";
import { deleteInputObject, deleteOutputObject } from "@/lib/storage";

/**
 * Removes input/output files for jobs older than 24h (completed or failed).
 * Call periodically with header x-worker-token matching WORKER_CALLBACK_TOKEN.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-worker-token");
  if (!token || token !== process.env.WORKER_CALLBACK_TOKEN) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await ensureSchema();

  const result = await db.query(
    `
    SELECT id, input_file_key, output_file_key
    FROM jobs
    WHERE updated_at < NOW() - INTERVAL '24 hours'
      AND status IN ('completed', 'failed')
      AND input_file_key IS NOT NULL
      AND input_file_key != '[purged]'
    `,
  );

  let purged = 0;
  for (const row of result.rows as { id: string; input_file_key: string; output_file_key: string | null }[]) {
    try {
      await deleteInputObject(row.input_file_key).catch(() => {});
      if (row.output_file_key) {
        await deleteOutputObject(row.output_file_key).catch(() => {});
      }
    } catch {
      /* ignore */
    }
    await db.query(
      `UPDATE jobs SET input_file_key = '[purged]', output_file_key = NULL, updated_at = NOW() WHERE id = $1`,
      [row.id],
    );
    purged++;
  }

  return NextResponse.json({ ok: true, purged });
}
