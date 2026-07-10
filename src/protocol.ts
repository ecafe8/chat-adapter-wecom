import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { authenticationError, networkError } from "./errors.js";
import type { Logger } from "chat";
import type { ResolvedWeComAdapterConfig, WeComFrame, WebSocketLike } from "./types.js";

export interface WeComProtocolClientOptions {
  config: ResolvedWeComAdapterConfig;
  logger: Logger;
  onFrame: (frame: WeComFrame) => Promise<void>;
}

export class WeComProtocolClient {
  private socket: WebSocketLike | null = null;
  private stopped = true;
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private reconnectDelay: number;
  private runPromise: Promise<void> | null = null;

  constructor(private readonly options: WeComProtocolClientOptions) {
    this.reconnectDelay = options.config.reconnectDelayMs;
  }

  start(): void {
    if (this.runPromise) return;
    this.stopped = false;
    this.runPromise = this.run().finally(() => { this.runPromise = null; });
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.clearTimers();
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    await this.runPromise?.catch(() => undefined);
  }

  send(frame: Record<string, unknown>): void {
    if (!this.socket || this.socket.OPEN !== 1) throw networkError("WeCom WebSocket is not connected");
    this.socket.send(JSON.stringify(frame));
  }

  private async run(): Promise<void> {
    while (!this.stopped) {
      try {
        await this.connectOnce();
      } catch (error) {
        if (!this.stopped) this.options.logger.error("WeCom connection cycle failed", error);
      }
      if (!this.stopped) await this.waitForReconnect();
    }
  }

  private connectOnce(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = (this.options.config.webSocketFactory ?? ((url: string) => new WebSocket(url) as unknown as WebSocketLike))(this.options.config.wsUrl);
      this.socket = socket;
      let subscribed = false;
      const requestId = randomUUID();
      const onClose = () => {
        this.clearHeartbeat();
        if (!subscribed) reject(networkError("WeCom socket closed before subscription"));
        else resolve();
      };
      socket.on("close", onClose);
      socket.on("error", (error: Error) => this.options.logger.error("WeCom WebSocket error", error));
      socket.on("message", (data: unknown) => {
        const text = typeof data === "string" ? data : Buffer.isBuffer(data) ? data.toString("utf8") : "";
        if (!text) return;
        let frame: Record<string, unknown>;
        try { frame = JSON.parse(text) as Record<string, unknown>; } catch { return; }
        const frameReqId = (frame.headers as { req_id?: string } | undefined)?.req_id;
        if (!subscribed && frameReqId === requestId) {
          if (frame.errcode !== 0) {
            reject(authenticationError(String(frame.errmsg ?? "WeCom subscription failed")));
            socket.close();
            return;
          }
          subscribed = true;
          this.reconnectDelay = this.options.config.reconnectDelayMs;
          this.startHeartbeat();
          this.options.logger.info("WeCom WebSocket subscribed");
          return;
        }
        void this.options.onFrame(frame).catch((error) => {
          this.options.logger.error("Failed to process WeCom WebSocket frame", error);
        });
      });
      socket.on("open", () => socket.send(JSON.stringify({
        cmd: "aibot_subscribe",
        headers: { req_id: requestId },
        body: { bot_id: this.options.config.botId, secret: this.options.config.secret },
      })));
    });
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      try { this.send({ cmd: "ping", headers: { req_id: randomUUID() } }); }
      catch (error) { this.options.logger.warn("WeCom heartbeat failed", error); }
    }, this.options.config.heartbeatIntervalMs);
  }

  private waitForReconnect(): Promise<void> {
    return new Promise((resolve) => {
      const delay = this.reconnectDelay;
      this.reconnectDelay = Math.min(delay * 2, this.options.config.maxReconnectDelayMs);
      this.reconnectTimer = setTimeout(() => { this.reconnectTimer = undefined; resolve(); }, delay);
    });
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
  }

  private clearTimers(): void {
    this.clearHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
  }
}
