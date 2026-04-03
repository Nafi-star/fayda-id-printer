import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type S3Env = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketInput: string;
  bucketOutput: string;
  forcePathStyle: boolean;
};

function guessMimeFromName(name: string) {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

const storageRoot = process.env.STORAGE_ROOT?.trim()
  ? path.resolve(process.env.STORAGE_ROOT.trim())
  : path.resolve(process.cwd(), "..", "storage");
const inputRoot = path.join(storageRoot, "input");
const outputRoot = path.join(storageRoot, "output");

// If S3 env is provided, we use object storage (needed for Vercel + remote worker).
const s3Env: S3Env | null = (() => {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const region = process.env.S3_REGION?.trim() ?? "us-east-1";
  const accessKeyId = process.env.S3_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.S3_SECRET_KEY?.trim();
  const bucketInput = process.env.S3_BUCKET_INPUT?.trim();
  const bucketOutput = process.env.S3_BUCKET_OUTPUT?.trim();
  const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE?.trim() ?? "true").toLowerCase() === "true";

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketInput || !bucketOutput) return null;
  return { endpoint, region, accessKeyId, secretAccessKey, bucketInput, bucketOutput, forcePathStyle };
})();

const s3 = s3Env
  ? new S3Client({
      region: s3Env.region,
      endpoint: s3Env.endpoint,
      credentials: { accessKeyId: s3Env.accessKeyId, secretAccessKey: s3Env.secretAccessKey },
      forcePathStyle: s3Env.forcePathStyle,
    })
  : null;

let bucketsInit: Promise<void> | null = null;
async function ensureBuckets() {
  if (!s3Env || !s3) return;
  if (bucketsInit) return bucketsInit;

  bucketsInit = (async () => {
    for (const bucket of [s3Env.bucketInput, s3Env.bucketOutput]) {
      try {
        await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch {
        try {
          await s3.send(new CreateBucketCommand({ Bucket: bucket }));
        } catch {
          /* ignore: bucket may already exist or backend doesn't require explicit creation */
        }
      }
    }
  })();

  return bucketsInit;
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  // S3 getObject Body is a stream in Node runtimes.
  const stream = body as AsyncIterable<Uint8Array>;
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

export function getInputAbsolutePath(inputKey: string) {
  return path.join(inputRoot, inputKey);
}

export function getOutputAbsolutePath(outputKey: string) {
  return path.join(outputRoot, outputKey);
}

export async function ensureStorageDirs() {
  // Only relevant for local filesystem fallback.
  if (s3Env) return;
  await mkdir(inputRoot, { recursive: true });
  await mkdir(outputRoot, { recursive: true });
}

export async function saveUploadToInput(userId: string, originalName: string, bytes: Uint8Array) {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = path.posix.join(
    "users",
    userId,
    "uploads",
    `${Date.now()}-${randomUUID()}-${safeName}`,
  );

  if (s3Env && s3) {
    await ensureBuckets();
    await s3.send(
      new PutObjectCommand({
        Bucket: s3Env.bucketInput,
        Key: key,
        Body: Buffer.from(bytes),
        ContentType: guessMimeFromName(originalName),
      }),
    );
    return key;
  }

  // Local fallback (dev / single-host setups).
  const absolutePath = path.join(inputRoot, key);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes);
  return key;
}

export async function readOutputFromStorage(outputKey: string) {
  if (s3Env && s3) {
    await ensureBuckets();
    const resp = await s3.send(new GetObjectCommand({ Bucket: s3Env.bucketOutput, Key: outputKey }));
    if (!resp.Body) throw new Error("S3 object missing body.");
    return await streamToBuffer(resp.Body);
  }
  return readFile(getOutputAbsolutePath(outputKey));
}

export async function deleteInputObject(inputKey: string) {
  if (s3Env && s3) {
    await ensureBuckets();
    await s3.send(new DeleteObjectCommand({ Bucket: s3Env.bucketInput, Key: inputKey }));
    return;
  }
  await unlink(getInputAbsolutePath(inputKey)).catch(() => {});
}

export async function deleteOutputObject(outputKey: string) {
  if (s3Env && s3) {
    await ensureBuckets();
    await s3.send(new DeleteObjectCommand({ Bucket: s3Env.bucketOutput, Key: outputKey }));
    return;
  }
  await unlink(getOutputAbsolutePath(outputKey)).catch(() => {});
}

