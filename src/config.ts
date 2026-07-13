import { AuthenticationError } from "@chat-adapter/shared";
import { ADAPTER_NAME, DEFAULT_WS_URL, type ResolvedWeComAdapterConfig, type WeComAdapterConfig } from "./types.js";

const firstNonEmpty = (...values: Array<string | undefined>) =>
  values.find((value) => value != null && value.trim() !== "")?.trim();

function numberEnv(value: string | undefined, fallback: number): number {
  const parsed = value == null ? Number.NaN : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const WECOM_STREAM_DEADLINE_LIMIT_MS = 10 * 60 * 1000;

export function resolveConfig(config: WeComAdapterConfig = {}): ResolvedWeComAdapterConfig {
  const botId = firstNonEmpty(config.botId, process.env.WECOM_BOT_ID);
  const secret = firstNonEmpty(config.secret, process.env.WECOM_BOT_SECRET);
  if (!botId) throw new AuthenticationError(ADAPTER_NAME, "botId is required. Pass config.botId or set WECOM_BOT_ID.");
  if (!secret) throw new AuthenticationError(ADAPTER_NAME, "secret is required. Pass config.secret or set WECOM_BOT_SECRET.");
  const streamDeadlineMs = clampDeadline(config.streamDeadlineMs ?? numberEnv(process.env.WECOM_STREAM_DEADLINE_MS, 9 * 60 * 1000));
  return {
    botId,
    secret,
    wsUrl: firstNonEmpty(config.wsUrl, process.env.WECOM_WS_URL) ?? DEFAULT_WS_URL,
    userName: firstNonEmpty(config.userName, process.env.WECOM_BOT_USERNAME) ?? "wecom-bot",
    heartbeatIntervalMs: config.heartbeatIntervalMs ?? numberEnv(process.env.WECOM_HEARTBEAT_INTERVAL_MS, 30_000),
    reconnectDelayMs: config.reconnectDelayMs ?? numberEnv(process.env.WECOM_RECONNECT_DELAY_MS, 1_000),
    maxReconnectDelayMs: config.maxReconnectDelayMs ?? numberEnv(process.env.WECOM_MAX_RECONNECT_DELAY_MS, 30_000),
    streamDeadlineMs,
    streamCoalesceMs: config.streamCoalesceMs ?? numberEnv(process.env.WECOM_STREAM_COALESCE_MS, 100),
    logger: config.logger,
    webSocketFactory: config.webSocketFactory,
  };
}

function clampDeadline(value: number): number {
  return Math.min(Math.max(value, 1_000), WECOM_STREAM_DEADLINE_LIMIT_MS);
}
