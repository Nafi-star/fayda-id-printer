import { NextRequest, NextResponse } from "next/server";

import { getUserFromSession } from "@/lib/auth";
import { ensureStorageDirs, saveUploadToInput } from "@/lib/storage";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

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
    return NextResponse.json({ message: "File is too large (max 25 MB)." }, { status: 400 });
  }

  await ensureStorageDirs();
  const key = await saveUploadToInput(user.id, fileName, bytes);

  return NextResponse.json({ inputFileKey: key });
}
