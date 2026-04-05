import { NextRequest, NextResponse } from "next/server";

import { getUserFromSession } from "@/lib/auth";
import { getPresignedPutForInputUpload } from "@/lib/storage";

const MAX_BYTES = 25 * 1024 * 1024;

function allowedUpload(name: string, mime: string): boolean {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf") || mime === "application/pdf") return true;
  if (n.endsWith(".png") || mime === "image/png") return true;
  if (n.endsWith(".jpg") || n.endsWith(".jpeg") || mime === "image/jpeg") return true;
  if (n.endsWith(".webp") || mime === "image/webp") return true;
  return false;
}

type Body = { fileName?: string; contentType?: string; fileSize?: number };

export async function POST(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  const user = await getUserFromSession(token);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 });
  }

  const fileName = body.fileName?.trim() || "upload";
  const contentType = body.contentType?.trim() ?? "";
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : NaN;

  if (!Number.isFinite(fileSize) || fileSize < 1 || fileSize > MAX_BYTES) {
    return NextResponse.json(
      { message: `File size must be between 1 and ${MAX_BYTES / (1024 * 1024)} MB.` },
      { status: 400 },
    );
  }

  if (!allowedUpload(fileName, contentType)) {
    return NextResponse.json(
      { message: "Use a Fayda PDF or a clear screenshot (PNG, JPG, or WEBP)." },
      { status: 400 },
    );
  }

  try {
    const { uploadUrl, inputFileKey, contentType: ct } = await getPresignedPutForInputUpload(
      user.id,
      fileName,
      contentType,
    );
    return NextResponse.json({ uploadUrl, inputFileKey, contentType: ct });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Storage not configured.";
    return NextResponse.json({ message: msg }, { status: 503 });
  }
}
