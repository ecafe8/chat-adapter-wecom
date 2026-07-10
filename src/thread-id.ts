import { ValidationError } from "@chat-adapter/shared";
import { ADAPTER_NAME, type WeComThreadId } from "./types.js";

function encodeSegment(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeSegment(value: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new ValidationError(ADAPTER_NAME, `Invalid thread ID segment: ${value}`);
  const decoded = Buffer.from(value, "base64url").toString("utf8");
  if (!decoded || encodeSegment(decoded) !== value) throw new ValidationError(ADAPTER_NAME, `Invalid thread ID segment: ${value}`);
  return decoded;
}

export function encodeThreadId(data: WeComThreadId): string {
  if (!data.id) throw new ValidationError(ADAPTER_NAME, "Thread ID must include an ID");
  return `${ADAPTER_NAME}:${data.type}:${encodeSegment(data.id)}`;
}

export function decodeThreadId(threadId: string): WeComThreadId {
  const parts = threadId.split(":");
  if (parts.length !== 3 || parts[0] !== ADAPTER_NAME || !["single", "group"].includes(parts[1])) {
    throw new ValidationError(ADAPTER_NAME, `Invalid WeCom thread ID: ${threadId}`);
  }
  return { type: parts[1] as WeComThreadId["type"], id: decodeSegment(parts[2]) };
}

export function channelIdFromThreadId(threadId: string): string {
  const data = decodeThreadId(threadId);
  return `${ADAPTER_NAME}:${data.type}:${encodeSegment(data.id)}`;
}
