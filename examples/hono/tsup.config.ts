import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  sourcemap: true,
  bundle: true,
  external: ["chat-adapter-wecom", "ws", "bufferutil", "utf-8-validate"],
});
