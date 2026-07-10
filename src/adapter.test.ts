import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { WeComAdapter } from "./adapter.js";
import type { WeComMessageCallback } from "./types.js";

const callback: WeComMessageCallback = {
  cmd: "aibot_msg_callback",
  headers: { req_id: "req-1" },
  body: {
    msgid: "msg-1",
    aibotid: "bot-1",
    chatid: "group-1",
    chattype: "group",
    from: { userid: "user-1" },
    msgtype: "text",
    text: { content: "hello **world**" },
  },
};

describe("WeComAdapter", () => {
  it("parses group text messages", () => {
    const adapter = new WeComAdapter({ botId: "bot-1", secret: "secret-1" });
    const message = adapter.parseMessage(callback);
    expect(message.id).toBe("msg-1");
    expect(message.threadId).toMatch(/^wecom:group:/);
    expect(message.text).toBe("hello **world**");
    expect(message.author.userId).toBe("user-1");
  });

  it("dispatches callbacks through Chat SDK and stores response context", async () => {
    const socket = { OPEN: 1, send: vi.fn(), close: vi.fn(), on: vi.fn() };
    const adapter = new WeComAdapter({ botId: "bot-1", secret: "secret-1", webSocketFactory: () => socket });
    const state = new Map<string, unknown>();
    const chat = {
      getLogger: () => ({ child: () => undefined, debug: () => {}, error: () => {}, info: () => {}, warn: () => {} }),
      getState: () => ({
        setIfNotExists: async (key: string, value: unknown) => { if (state.has(key)) return false; state.set(key, value); return true; },
        set: async (key: string, value: unknown) => { state.set(key, value); },
        get: async <T>(key: string) => state.get(key) as T ?? null,
      }),
      processMessage: vi.fn(async (_adapter, threadId, factory) => {
        await factory();
        await adapter.postMessage(threadId, "reply");
      }),
    };
    (adapter as unknown as { chat: unknown }).chat = chat;
    (adapter as unknown as { state: unknown }).state = {
      markMessageSeen: async () => true,
      setRequestId: async (threadId: string, requestId: string) => { state.set(`request:${threadId}`, requestId); },
      getRequestId: async (threadId: string) => state.get(`request:${threadId}`),
    };
    (adapter as unknown as { protocol: { send: typeof socket.send } }).protocol = { send: socket.send };
    const handleFrame = (adapter as unknown as { processFrame: (frame: unknown) => Promise<void> }).processFrame;
    await handleFrame.call(adapter, callback);
    expect(chat.processMessage).toHaveBeenCalledOnce();
    expect(socket.send).toHaveBeenCalledWith(expect.objectContaining({
      cmd: "aibot_respond_msg",
      headers: { req_id: "req-1" },
    }));
  });
});
