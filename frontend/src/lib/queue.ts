import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not configured.");
}

const queueName = "jobs:convert";
const redis = new Redis(redisUrl, { maxRetriesPerRequest: 3 });

export type QueuePayload = {
  job_id: string;
  user_id: string;
  input_file_key: string;
  output_prefix: string;
  color_mode: "color" | "bw";
};

export async function pushConversionJob(payload: QueuePayload) {
  await redis.rpush(queueName, JSON.stringify(payload));
}
