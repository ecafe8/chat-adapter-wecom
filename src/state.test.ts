import { describe, expect, it } from "vitest";
import type { StateAdapter } from "chat";
import { WeComRuntimeState } from "./state.js";

function fakeState(): StateAdapter {
  const values = new Map<string, unknown>();
  return {
    acquireLock: async () => null,
    appendToList: async () => {},
    connect: async () => {},
    delete: async (key) => { values.delete(key); },
    dequeue: async () => null,
    disconnect: async () => {},
    enqueue: async () => 0,
    extendLock: async () => false,
    forceReleaseLock: async () => {},
    get: async <T>(key: string) => values.get(key) as T ?? null,
    getList: async () => [],
    isSubscribed: async () => false,
    queueDepth: async () => 0,
    releaseLock: async () => {},
    set: async (key, value) => { values.set(key, value); },
    setIfNotExists: async (key, value) => {
      if (values.has(key)) return false;
      values.set(key, value);
      return true;
    },
    subscribe: async () => {},
    unsubscribe: async () => {},
  } as StateAdapter;
}

describe("WeComRuntimeState", () => {
  it("deduplicates message IDs through StateAdapter", async () => {
    const state = new WeComRuntimeState(fakeState(), "bot-1");
    expect(await state.markMessageSeen("msg-1")).toBe(true);
    expect(await state.markMessageSeen("msg-1")).toBe(false);
  });
});
