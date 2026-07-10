import "dotenv/config";

import { serve } from "@hono/node-server";
import type { Server } from "node:http";
import { createApp } from "./app.js";
import { createBot } from "./bot.js";

const bot = createBot();
await bot.initialize();

const server = serve({
  fetch: createApp().fetch,
  port: Number(process.env.PORT ?? 8787),
}, (info) => {
  console.log(`Hono server listening on http://localhost:${info.port}`);
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down`);
  await bot.shutdown();
  (server as Server).close(() => process.exit(0));
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
