import type { StateAdapter } from "chat";
import type { WeComRuntimeState as WeComRuntimeStateContract } from "./types.js";

const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TTL_MS = 10 * 60 * 1000;

export class WeComRuntimeState implements WeComRuntimeStateContract {
  constructor(private readonly state: StateAdapter, private readonly botId: string) {}

  async markMessageSeen(messageId: string): Promise<boolean> {
    return this.state.setIfNotExists(`wecom:${this.botId}:message:${messageId}`, true, MESSAGE_TTL_MS);
  }

  async setRequestId(threadId: string, requestId: string): Promise<void> {
    await this.state.set(`wecom:${this.botId}:request:${threadId}`, requestId, REQUEST_TTL_MS);
  }

  async getRequestId(threadId: string): Promise<string | undefined> {
    return (await this.state.get<string>(`wecom:${this.botId}:request:${threadId}`)) ?? undefined;
  }
}
