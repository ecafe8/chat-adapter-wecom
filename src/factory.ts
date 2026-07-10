import type { Logger } from "chat";
import { WeComAdapter } from "./adapter.js";
import type { WeComAdapterConfig } from "./types.js";

export function createWeComAdapter(config: WeComAdapterConfig & { logger?: Logger } = {}): WeComAdapter {
  return new WeComAdapter(config);
}
