import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromSession } from "@/lib/auth";
import { db, ensureSchema } from "@/lib/db";
import { getOutputAbsolutePath } from "@/lib/storage";

type Params = { params: Promise<{ jobId: string }> };

function mimeForPath(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
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

  const absolutePath = getOutputAbsolutePath(job.output_file_key);
  try {
    await stat(absolutePath);
  } catch {
    return NextResponse.json({ message: "Output file missing." }, { status: 404 });
  }

  const filename = path.basename(absolutePath);
  const bytes = await readFile(absolutePath);
  const contentType = mimeForPath(absolutePath);
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const disposition = inline
    ? `inline; filename="${filename}"`
    : `attachment; filename="${filename}"`;

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
