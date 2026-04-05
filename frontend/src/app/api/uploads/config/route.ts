import { NextResponse } from "next/server";

import { isS3StorageEnabled } from "@/lib/storage";

/**
 * Tells the client whether to use presigned direct-to-S3 upload (production)
 * or multipart POST to /api/uploads (local disk / small files).
 */
export async function GET() {
  const directUpload = isS3StorageEnabled();
  const maxMultipartBytes =
    process.env.VERCEL === "1" && !directUpload
      ? 4 * 1024 * 1024
      : 25 * 1024 * 1024;

  return NextResponse.json({
    directUpload,
    maxMultipartBytes,
  });
}
