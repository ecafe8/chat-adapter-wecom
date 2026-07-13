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
    const seen = new Set<string>();
    const chat = {
      getLogger: () => ({ child: () => undefined, debug: () => {}, error: () => {}, info: () => {}, warn: () => {} }),
      getState: () => ({
        setIfNotExists: async (key: string) => { if (seen.has(key)) return false; seen.add(key); return true; },
      }),
      processMessage: vi.fn(async (_adapter, threadId, factory) => {
        await factory();
        await adapter.postMessage(threadId, "reply");
      }),
    };
    await adapter.initialize(chat as never);
    (adapter as unknown as { protocol: { send: typeof socket.send } }).protocol = { send: socket.send };
    const handleFrame = (adapter as unknown as { processFrame: (frame: unknown) => Promise<void> }).processFrame;
    await handleFrame.call(adapter, callback);
    expect(chat.processMessage).toHaveBeenCalledOnce();
    expect(socket.send).toHaveBeenCalledWith(expect.objectContaining({
      cmd: "aibot_respond_msg",
      headers: { req_id: "req-1" },
    }));
  });

  it("keeps concurrent callbacks to the same thread from clobbering each other's req_id", async () => {
    const socket = { OPEN: 1, send: vi.fn(), close: vi.fn(), on: vi.fn() };
    const adapter = new WeComAdapter({ botId: "bot-1", secret: "secret-1", webSocketFactory: () => socket });
    const seen = new Set<string>();
    const chat = {
      getLogger: () => ({ child: () => undefined, debug: () => {}, error: () => {}, info: () => {}, warn: () => {} }),
      getState: () => ({
        setIfNotExists: async (key: string) => { if (seen.has(key)) return false; seen.add(key); return true; },
      }),
      // Simulate a slow handler: post an initial reply, await some async
      // work, then post the final reply — the second callback for the same
      // thread arrives and is processed while the first is still "awaiting".
      processMessage: vi.fn(async (_adapter, threadId, factory) => {
        const message = await factory();
        await adapter.postMessage(threadId, `ack:${message.id}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
        await adapter.postMessage(threadId, `final:${message.id}`);
      }),
    };
    await adapter.initialize(chat as never);
    (adapter as unknown as { protocol: { send: typeof socket.send } }).protocol = { send: socket.send };
    const handleFrame = (adapter as unknown as { processFrame: (frame: unknown) => Promise<void> }).processFrame;

    const second: WeComMessageCallback = {
      ...callback,
      headers: { req_id: "req-2" },
      body: { ...callback.body, msgid: "msg-2" },
    };

    // Both callbacks target the same thread (same group chatid) and overlap
    // in time — the second one's dispatch starts before the first one's
    // "final" reply is posted.
    await Promise.all([handleFrame.call(adapter, callback), handleFrame.call(adapter, second)]);

    const sent = socket.send.mock.calls.map(([frame]) => frame as { headers: { req_id: string } });
    const forFirst = sent.filter((frame) => frame.headers.req_id === "req-1");
    const forSecond = sent.filter((frame) => frame.headers.req_id === "req-2");
    // Each callback's two replies (ack + final) must use that callback's own
    // req_id, never the other callback's.
    expect(forFirst).toHaveLength(2);
    expect(forSecond).toHaveLength(2);
  });
});
