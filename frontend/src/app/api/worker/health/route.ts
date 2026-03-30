import { NextResponse } from "next/server";

const workerBaseUrl = process.env.WORKER_BASE_URL ?? "http://localhost:8001";

export async function GET() {
  try {
    const response = await fetch(`${workerBaseUrl}/health`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, message: "Worker responded with an error." },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json({ ok: true, worker: data });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Cannot reach worker service." },
      { status: 502 },
    );
  }
}
