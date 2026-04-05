import { NextRequest, NextResponse } from "next/server";

import { getUserFromSession } from "@/lib/auth";
import { ensureStorageDirs, saveUploadToInput } from "@/lib/storage";

/** Vercel serverless request bodies are capped (~4.5 MB). Stay under that on production Vercel. */
const VERCEL_SAFE_MAX_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB (local / self-hosted)

const MAX_BYTES =
  process.env.VERCEL === "1" ? Math.min(DEFAULT_MAX_BYTES, VERCEL_SAFE_MAX_BYTES) : DEFAULT_MAX_BYTES;

function allowedUpload(name: string, mime: string): boolean {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf") || mime === "application/pdf") return true;
  if (n.endsWith(".png") || mime === "image/png") return true;
  if (n.endsWith(".jpg") || n.endsWith(".jpeg") || mime === "image/jpeg") return true;
  if (n.endsWith(".webp") || mime === "image/webp") return true;
  return false;
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "File is required." }, { status: 400 });
  }

  const fileName = file.name || "upload";
  if (!allowedUpload(fileName, file.type || "")) {
    return NextResponse.json(
      { message: "Use a Fayda PDF or a clear screenshot (PNG, JPG, or WEBP)." },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_BYTES) {
    const msg =
      process.env.VERCEL === "1"
        ? "File is too large for Vercel hosting (max about 4 MB per upload). Compress the PDF or use a smaller export."
        : `File is too large (max ${Math.floor(MAX_BYTES / (1024 * 1024))} MB).`;
    return NextResponse.json({ message: msg }, { status: 400 });
  }

  await ensureStorageDirs();
  const key = await saveUploadToInput(user.id, fileName, bytes);

  return NextResponse.json({ inputFileKey: key });
}
