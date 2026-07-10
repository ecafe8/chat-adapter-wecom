import { afterEach, describe, expect, it } from "vitest";
import { createWeComAdapter } from "./factory.js";

describe("createWeComAdapter", () => {
  const original = { ...process.env };

  afterEach(() => { process.env = { ...original }; });

  it("resolves explicit credentials before environment values", () => {
    process.env.WECOM_BOT_ID = "env-bot";
    process.env.WECOM_BOT_SECRET = "env-secret";
    expect(createWeComAdapter({ botId: "config-bot", secret: "config-secret" }).botUserId).toBe("config-bot");
  });

  it("resolves credentials from environment", () => {
    process.env.WECOM_BOT_ID = "env-bot";
    process.env.WECOM_BOT_SECRET = "env-secret";
    expect(createWeComAdapter().botUserId).toBe("env-bot");
  });

  it("rejects missing credentials", () => {
    delete process.env.WECOM_BOT_ID;
    delete process.env.WECOM_BOT_SECRET;
    expect(() => createWeComAdapter()).toThrow("WECOM_BOT_ID");
  });
});
