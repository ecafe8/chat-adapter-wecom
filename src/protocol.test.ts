import { describe, expect, it, vi } from "vitest";
import { ConsoleLogger } from "chat";
import { WeComProtocolClient } from "./protocol.js";
import type { WebSocketLike } from "./types.js";

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;

class FakeSocket implements WebSocketLike {
  readonly OPEN = OPEN;
  readyState = CONNECTING;
  sent: string[] = [];
  private listeners = new Map<string, ((...args: any[]) => void)[]>();

  on(event: "open" | "message" | "error" | "close", listener: (...args: any[]) => void): void {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
  }
  send(data: string): void { this.sent.push(data); }
  close(): void {
    this.readyState = CLOSED;
    this.emit("close");
  }
  open(): void {
    this.readyState = OPEN;
    this.emit("open");
  }
  emit(event: string, ...args: unknown[]): void { for (const fn of this.listeners.get(event) ?? []) fn(...args); }
  receive(frame: unknown): void { this.emit("message", JSON.stringify(frame)); }
}

const config = {
  botId: "bot-1",
  secret: "secret-1",
  wsUrl: "wss://test",
  userName: "bot",
  heartbeatIntervalMs: 10,
  reconnectDelayMs: 5,
  maxReconnectDelayMs: 10,
};

describe("WeComProtocolClient", () => {
  it("subscribes and dispatches frames after authentication", async () => {
    const socket = new FakeSocket();
    const onFrame = vi.fn(async () => {});
    const client = new WeComProtocolClient({
      config: { ...config, webSocketFactory: () => socket },
      logger: new ConsoleLogger("silent"),
      onFrame,
    });
    client.start();
    socket.open();
    const request = JSON.parse(socket.sent[0]);
    expect(request).toMatchObject({ cmd: "aibot_subscribe", body: { bot_id: "bot-1", secret: "secret-1" } });
    socket.receive({ headers: { req_id: request.headers.req_id }, errcode: 0 });
    socket.receive({ cmd: "aibot_msg_callback", headers: { req_id: "msg-1" } });
    await vi.waitFor(() => expect(onFrame).toHaveBeenCalledOnce());
    await client.stop();
  });

  it("sends heartbeat and stops it on shutdown", async () => {
    vi.useFakeTimers();
    const socket = new FakeSocket();
    const client = new WeComProtocolClient({
      config: { ...config, webSocketFactory: () => socket },
      logger: new ConsoleLogger("silent"),
      onFrame: async () => {},
    });
    client.start();
    socket.open();
    const request = JSON.parse(socket.sent[0]);
    socket.receive({ headers: { req_id: request.headers.req_id }, errcode: 0 });
    vi.advanceTimersByTime(11);
    expect(socket.sent.some((entry) => JSON.parse(entry).cmd === "ping")).toBe(true);
    await client.stop();
    const sent = socket.sent.length;
    vi.advanceTimersByTime(100);
    expect(socket.sent).toHaveLength(sent);
    vi.useRealTimers();
  });

  it("rejects send() when the socket is not actually open", async () => {
    const socket = new FakeSocket();
    const client = new WeComProtocolClient({
      config: { ...config, webSocketFactory: () => socket },
      logger: new ConsoleLogger("silent"),
      onFrame: async () => {},
    });

    // Never subscribed / still connecting: OPEN is a constant (always 1 on
    // a real `ws` socket) so the guard must check `readyState`, not `OPEN`.
    expect(() => client.send({ cmd: "ping" })).toThrow("WeCom WebSocket is not connected");

    client.start();
    socket.open();
    const request = JSON.parse(socket.sent[0]);
    socket.receive({ headers: { req_id: request.headers.req_id }, errcode: 0 });

    // Socket closes (e.g. dropped by the server) but a reconnect has not
    // completed yet: send() must not silently hand data to a dead socket.
    socket.close();
    expect(() => client.send({ cmd: "ping" })).toThrow("WeCom WebSocket is not connected");

    await client.stop();
  });
});
