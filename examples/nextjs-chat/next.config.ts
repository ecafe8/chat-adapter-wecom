import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "chat-adapter-wecom",
    "ws",
    "bufferutil",
    "utf-8-validate",
  ],
};

export default nextConfig;
