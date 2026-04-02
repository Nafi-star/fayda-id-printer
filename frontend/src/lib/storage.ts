import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const storageRoot = process.env.STORAGE_ROOT?.trim()
  ? path.resolve(process.env.STORAGE_ROOT.trim())
  : path.resolve(process.cwd(), "..", "storage");
const inputRoot = path.join(storageRoot, "input");
const outputRoot = path.join(storageRoot, "output");

export function getInputAbsolutePath(inputKey: string) {
  return path.join(inputRoot, inputKey);
}

export async function ensureStorageDirs() {
  await mkdir(inputRoot, { recursive: true });
  await mkdir(outputRoot, { recursive: true });
}

export function getOutputAbsolutePath(outputKey: string) {
  return path.join(outputRoot, outputKey);
}

export async function saveUploadToInput(userId: string, originalName: string, bytes: Uint8Array) {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = path.join("users", userId, "uploads", `${Date.now()}-${randomUUID()}-${safeName}`);
  const absolutePath = path.join(inputRoot, key);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes);

  return key.replaceAll("\\", "/");
}

