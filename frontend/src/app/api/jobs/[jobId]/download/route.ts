import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "node:buffer";

import { getUserFromSession } from "@/lib/auth";
import { db, ensureSchema } from "@/lib/db";
import { readOutputFromStorage } from "@/lib/storage";

type Params = { params: Promise<{ jobId: string }> };

function mimeForKey(fileKey: string) {
  const ext = path.extname(fileKey).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

export async function GET(req: NextRequest, { params }: Params) {
  const token = req.cookies.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  await ensureSchema();

  const result = await db.query(
    `
      SELECT id, user_id, output_file_key, status
      FROM jobs
      WHERE id = $1 AND user_id = $2
    `,
    [jobId, user.id],
  );

  const job = result.rows[0] as
    | { id: string; user_id: string; output_file_key: string | null; status: string }
    | undefined;

  if (!job) return NextResponse.json({ message: "Job not found." }, { status: 404 });
  if (job.status !== "completed" || !job.output_file_key) {
    return NextResponse.json({ message: "Output is not ready yet." }, { status: 400 });
  }

  let bytes: Buffer;
  try {
    bytes = await readOutputFromStorage(job.output_file_key);
  } catch {
    return NextResponse.json({ message: "Output file missing." }, { status: 404 });
  }

  const filename = path.basename(job.output_file_key);
  const contentType = mimeForKey(job.output_file_key);
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const disposition = inline
    ? `inline; filename="${filename}"`
    : `attachment; filename="${filename}"`;

  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new NextResponse(ab, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
