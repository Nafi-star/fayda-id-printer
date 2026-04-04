import Redis from "ioredis";

const queueName = "jobs:convert";

let redis: Redis | null = null;

function getRedis(): Redis {
  if (redis) return redis;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is not configured.");
  }
  const useTls = redisUrl.startsWith("rediss://");
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    ...(useTls ? { tls: { rejectUnauthorized: true } } : {}),
  });
  return redis;
}

export type QueuePayload = {
  job_id: string;
  user_id: string;
  input_file_key: string;
  output_prefix: string;
  color_mode: "color" | "bw";
};

export async function pushConversionJob(payload: QueuePayload) {
  await getRedis().rpush(queueName, JSON.stringify(payload));
}
