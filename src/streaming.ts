import { randomUUID } from "node:crypto";
import type { Logger, RawMessage, StreamChunk } from "chat";
import type { WeComProtocolClient } from "./protocol.js";
import type { WeComMessageCallback, WeComStreamFrame } from "./types.js";

export type WeComStreamSource = AsyncIterable<string | StreamChunk>;

export type WeComStreamCancelReason = "disconnect" | "deadline" | "manual";

export interface WeComStreamerOptions {
  threadId: string;
  reqId: string;
  protocol: WeComProtocolClient;
  logger: Logger;
  deadlineMs: number;
  coalesceMs: number;
  onDone: (streamId: string) => void;
}

export function extractStreamText(chunk: string | StreamChunk): string | null {
  if (typeof chunk === "string") return chunk;
  if (chunk && typeof chunk === "object" && chunk.type === "markdown_text") return chunk.text;
  return null;
}

export class WeComStreamer {
  readonly streamId: string;
  private readonly threadId: string;
  private readonly reqId: string;
  private readonly protocol: WeComProtocolClient;
  private readonly logger: Logger;
  private readonly deadlineMs: number;
  private readonly coalesceMs: number;
  private readonly onDone: (streamId: string) => void;

  private accumulated = "";
  private lastSentContent = "";
  private cancelled = false;
  private cancelReason: WeComStreamCancelReason | undefined;
  private deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  private coalesceTimer: ReturnType<typeof setTimeout> | undefined;
  private iterator: AsyncIterator<string | StreamChunk> | undefined;

  constructor(options: WeComStreamerOptions) {
    this.streamId = randomUUID();
    this.threadId = options.threadId;
    this.reqId = options.reqId;
    this.protocol = options.protocol;
    this.logger = options.logger;
    this.deadlineMs = options.deadlineMs;
    this.coalesceMs = options.coalesceMs;
    this.onDone = options.onDone;
  }

  async run(source: WeComStreamSource): Promise<RawMessage<WeComMessageCallback>> {
    this.startDeadline();
    const iterator = source[Symbol.asyncIterator]();
    this.iterator = iterator;
    try {
      while (!this.cancelled) {
        const result = await iterator.next();
        if (result.done) break;
        const text = extractStreamText(result.value);
        if (text !== null && text !== "") {
          this.accumulated += text;
          this.scheduleFlush();
        }
      }
      if (this.cancelled) {
        if (this.cancelReason === "disconnect") {
          // Socket is gone; do not attempt to send.
        } else {
          this.sendFrame(true);
        }
      } else {
        this.flushNow();
        this.sendFrame(true);
      }
      return { id: this.streamId, threadId: this.threadId, raw: {} as WeComMessageCallback };
    } catch (error) {
      this.logger.error("WeCom stream iterator failed", error);
      this.sendFrame(true);
      throw error;
    } finally {
      this.cleanup();
      await iterator.return?.().catch(() => undefined);
    }
  }

  cancel(reason: WeComStreamCancelReason): void {
    if (this.cancelled) return;
    this.cancelled = true;
    this.cancelReason = reason;
    if (this.deadlineTimer) {
      clearTimeout(this.deadlineTimer);
      this.deadlineTimer = undefined;
    }
    if (this.coalesceTimer) {
      clearTimeout(this.coalesceTimer);
      this.coalesceTimer = undefined;
    }
    const iterator = this.iterator;
    if (iterator) void iterator.return?.().catch(() => undefined);
  }

  private startDeadline(): void {
    this.deadlineTimer = setTimeout(() => {
      this.logger.warn("WeCom stream exceeded deadline; finalizing", { streamId: this.streamId });
      this.cancel("deadline");
    }, this.deadlineMs);
  }

  private scheduleFlush(): void {
    if (this.cancelled) return;
    if (this.coalesceMs <= 0) {
      this.sendFrame(false);
      return;
    }
    if (this.coalesceTimer) return;
    this.coalesceTimer = setTimeout(() => {
      this.coalesceTimer = undefined;
      if (!this.cancelled) this.sendFrame(false);
    }, this.coalesceMs);
  }

  private flushNow(): void {
    if (this.coalesceTimer) {
      clearTimeout(this.coalesceTimer);
      this.coalesceTimer = undefined;
    }
  }

  private sendFrame(finish: boolean): void {
    if (this.cancelReason === "disconnect") return;
    if (!finish && this.accumulated === this.lastSentContent) return;
    const frame: WeComStreamFrame = {
      cmd: "aibot_respond_msg",
      headers: { req_id: this.reqId },
      body: {
        msgtype: "stream",
        stream: {
          id: this.streamId,
          finish,
          content: this.accumulated,
        },
      },
    };
    try {
      this.protocol.send(frame);
      this.lastSentContent = this.accumulated;
    } catch (error) {
      if (finish) this.logger.warn("WeCom stream final frame could not be sent", { streamId: this.streamId, error });
      else this.logger.warn("WeCom stream update frame could not be sent", { streamId: this.streamId, error });
    }
  }

  private cleanup(): void {
    if (this.deadlineTimer) {
      clearTimeout(this.deadlineTimer);
      this.deadlineTimer = undefined;
    }
    if (this.coalesceTimer) {
      clearTimeout(this.coalesceTimer);
      this.coalesceTimer = undefined;
    }
    this.onDone(this.streamId);
  }
}
