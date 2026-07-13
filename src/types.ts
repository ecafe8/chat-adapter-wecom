import type { Logger, StateAdapter } from "chat";

export const ADAPTER_NAME = "wecom";
export const DEFAULT_WS_URL = "wss://openws.work.weixin.qq.com";

export interface WeComThreadId {
  type: "single" | "group";
  id: string;
}

export interface WeComPollingConfig {
  heartbeatIntervalMs?: number;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

export interface WeComAdapterConfig extends WeComPollingConfig {
  botId?: string;
  secret?: string;
  wsUrl?: string;
  userName?: string;
  logger?: Logger;
  webSocketFactory?: WebSocketFactory;
}

export interface ResolvedWeComAdapterConfig {
  botId: string;
  secret: string;
  wsUrl: string;
  userName: string;
  heartbeatIntervalMs: number;
  reconnectDelayMs: number;
  maxReconnectDelayMs: number;
  logger?: Logger;
  webSocketFactory?: WebSocketFactory;
}

export interface WeComMessageCallback {
  cmd: "aibot_msg_callback";
  headers: { req_id: string };
  body: {
    msgid: string;
    aibotid: string;
    chatid?: string;
    chattype: "single" | "group";
    from: { userid: string };
    msgtype: "text" | string;
    text?: { content: string };
  };
}

export interface WeComEventCallback {
  cmd: "aibot_event_callback";
  headers: { req_id: string };
  body: { msgid?: string; event?: { eventtype?: string } };
}

export type WeComFrame = WeComMessageCallback | WeComEventCallback | Record<string, unknown>;

export interface WebSocketLike {
  readonly OPEN: number;
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  on(event: "open" | "message" | "error" | "close", listener: (...args: any[]) => void): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

export interface WeComRuntimeState {
  markMessageSeen(messageId: string): Promise<boolean>;
}

export type WeComState = StateAdapter;
