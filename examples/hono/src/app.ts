import { Hono } from "hono";

export function createApp() {
  const app = new Hono();

  app.get("/", (c) => c.json({
    name: "chat-adapter-wecom-hono-example",
    status: "ok",
    test: "Mention the WeCom intelligent robot in a group.",
  }));

  app.get("/health", (c) => c.json({ status: "ok" }));

  return app;
}
