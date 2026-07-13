import {
  ConsoleLogger,
  Message,
  NotImplementedError,
  type Adapter,
  type AdapterPostableMessage,
  type ChatInstance,
  type EmojiValue,
  type FetchOptions,
  type FetchResult,
  type FormattedContent,
  type Logger,
  type RawMessage,
  type StreamChunk,
  type StreamOptions,
  type ThreadInfo,
  type WebhookOptions,
} from "chat";
import { stringifyMarkdown } from "chat";
import { WeComFormatConverter } from "./format-converter.js";
import { resolveConfig } from "./config.js";
import { WeComProtocolClient } from "./protocol.js";
import { getCurrentRequestId, runWithRequestId } from "./request-context.js";
import { WeComRuntimeState } from "./state.js";
import { WeComStreamer, type WeComStreamCancelReason } from "./streaming.js";
import { channelIdFromThreadId, decodeThreadId, encodeThreadId } from "./thread-id.js";
import type { ResolvedWeComAdapterConfig, WeComAdapterConfig, WeComFrame, WeComMessageCallback, WeComThreadId } from "./types.js";

export class WeComAdapter implements Adapter<WeComThreadId, WeComMessageCallback> {
  readonly name = "wecom";
  readonly persistThreadHistory = true;
  readonly userName: string;
  readonly botUserId: string;

  private readonly config: ResolvedWeComAdapterConfig;
  private readonly converter = new WeComFormatConverter();
  private readonly protocol: WeComProtocolClient;
  private chat: ChatInstance | null = null;
  private state: WeComRuntimeState | null = null;
  private readonly activeStreams = new Map<string, WeComStreamer>();
  private logger: Logger;

  constructor(config: WeComAdapterConfig = {}) {
    this.config = resolveConfig(config);
    this.userName = this.config.userName;
    this.botUserId = this.config.botId;
    this.logger = this.config.logger ?? new ConsoleLogger("info", this.name);
    this.protocol = new WeComProtocolClient({
      config: this.config,
      logger: this.logger,
      onFrame: (frame) => this.processFrame(frame),
      onDisconnect: () => this.cancelActiveStreams("disconnect"),
    });
  }

  async initialize(chat: ChatInstance): Promise<void> {
    this.chat = chat;
    this.logger = chat.getLogger(this.name);
    this.state = new WeComRuntimeState(chat.getState(), this.config.botId);
    this.protocol.start();
  }

  async disconnect(): Promise<void> {
    this.cancelActiveStreams("manual");
    await this.protocol.stop();
    this.chat = null;
    this.state = null;
  }

  encodeThreadId(data: WeComThreadId): string { return encodeThreadId(data); }
  decodeThreadId(threadId: string): WeComThreadId { return decodeThreadId(threadId); }
  channelIdFromThreadId(threadId: string): string { return channelIdFromThreadId(threadId); }
  isDM(threadId: string): boolean { return decodeThreadId(threadId).type === "single"; }

  async handleWebhook(_request: Request, _options?: WebhookOptions): Promise<Response> {
    return Response.json({ error: "WeCom adapter uses WebSocket long connection" }, { status: 501 });
  }

  parseMessage(raw: WeComMessageCallback): Message<WeComMessageCallback> {
    const body = raw.body;
    if (body.msgtype !== "text" || !body.text?.content) {
      throw new Error(`Unsupported WeCom message type: ${body.msgtype}`);
    }
    const threadId = this.threadIdFor(body);
    return new Message({
      id: body.msgid,
      threadId,
      text: body.text.content,
      formatted: this.converter.toAst(body.text.content),
      raw,
      author: {
        userId: body.from.userid,
        userName: body.from.userid,
        fullName: body.from.userid,
        isBot: false,
        isMe: false,
      },
      metadata: { dateSent: new Date(), edited: false },
      attachments: [],
      isMention: body.chattype === "group",
    });
  }

  renderFormatted(content: FormattedContent): string { return this.converter.fromAst(content); }

  async postMessage(threadId: string, message: AdapterPostableMessage): Promise<RawMessage<WeComMessageCallback>> {
    if (!this.chat || !this.state) throw new Error("WeCom adapter is not initialized");
    const requestId = getCurrentRequestId();
    if (!requestId) throw new Error(`No active WeCom callback context for ${threadId}`);
    const content = this.renderPostable(message);
    if (!content) throw new Error("Cannot send an empty WeCom message");
    this.protocol.send({
      cmd: "aibot_respond_msg",
      headers: { req_id: requestId },
      body: { msgtype: "markdown", markdown: { content } },
    });
    return { id: requestId, threadId, raw: {} as WeComMessageCallback };
  }

  async stream(
    threadId: string,
    textStream: AsyncIterable<string | StreamChunk>,
    _options?: StreamOptions,
  ): Promise<RawMessage<WeComMessageCallback> | null> {
    if (!this.chat) throw new Error("WeCom adapter is not initialized");
    const reqId = getCurrentRequestId();
    if (!reqId) throw new Error(`No active WeCom callback context for streaming to ${threadId}`);
    const streamer = new WeComStreamer({
      threadId,
      reqId,
      protocol: this.protocol,
      logger: this.logger,
      deadlineMs: this.config.streamDeadlineMs,
      coalesceMs: this.config.streamCoalesceMs,
      onDone: (streamId) => this.activeStreams.delete(streamId),
    });
    this.activeStreams.set(streamer.streamId, streamer);
    return streamer.run(textStream);
  }

  async fetchMessages(_threadId: string, _options?: FetchOptions): Promise<FetchResult<WeComMessageCallback>> {
    return { messages: [] };
  }

  async fetchThread(threadId: string): Promise<ThreadInfo> {
    const data = decodeThreadId(threadId);
    return { id: threadId, channelId: this.channelIdFromThreadId(threadId), channelName: data.id, isDM: data.type === "single", metadata: { ...data } };
  }

  async startTyping(_threadId: string, _status?: string): Promise<void> {}
  async addReaction(_threadId: string, _messageId: string, _emoji: EmojiValue | string): Promise<void> { throw new NotImplementedError("WeCom reactions are not supported", "addReaction"); }
  async removeReaction(_threadId: string, _messageId: string, _emoji: EmojiValue | string): Promise<void> { throw new NotImplementedError("WeCom reactions are not supported", "removeReaction"); }
  async editMessage(_threadId: string, _messageId: string, _message: AdapterPostableMessage): Promise<RawMessage<WeComMessageCallback>> { throw new NotImplementedError("WeCom message editing is not supported", "editMessage"); }
  async deleteMessage(_threadId: string, _messageId: string): Promise<void> { throw new NotImplementedError("WeCom message deletion is not supported", "deleteMessage"); }

  private cancelActiveStreams(reason: WeComStreamCancelReason): void {
    if (this.activeStreams.size === 0) return;
    const streams = Array.from(this.activeStreams.values());
    this.activeStreams.clear();
    for (const streamer of streams) streamer.cancel(reason);
  }

  private async processFrame(frame: WeComFrame): Promise<void> {
    if (!this.chat || !this.state || frame.cmd !== "aibot_msg_callback") return;
    const callback = frame as WeComMessageCallback;
    this.logger.info("Received WeCom message callback", {
      msgid: callback.body.msgid,
      chattype: callback.body.chattype,
      msgtype: callback.body.msgtype,
    });
    if (!(await this.state.markMessageSeen(callback.body.msgid))) return;
    if (callback.body.msgtype !== "text" || !callback.body.text?.content) return;
    const threadId = this.threadIdFor(callback.body);
    try {
      await runWithRequestId(callback.headers.req_id, () =>
        this.chat!.processMessage(this, threadId, async () => this.parseMessage(callback)));
    } catch (error) {
      this.logger.error("Failed to dispatch WeCom message callback", error);
    }
  }

  private threadIdFor(body: WeComMessageCallback["body"]): string {
    return encodeThreadId({ type: body.chattype, id: body.chattype === "group" ? body.chatid ?? "" : body.from.userid });
  }

  private renderPostable(message: AdapterPostableMessage): string {
    if (typeof message === "string") return message;
    if ("raw" in message && typeof message.raw === "string") return message.raw;
    if ("markdown" in message) return message.markdown;
    if ("ast" in message) return stringifyMarkdown(message.ast);
    return this.converter.renderPostable(message);
  }

}
