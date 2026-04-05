import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Expose to client so the dashboard can enforce Vercel’s ~4.5 MB serverless body limit before upload.
  env: {
    NEXT_PUBLIC_VERCEL: process.env.VERCEL ?? "",
  },
};

export default nextConfig;
