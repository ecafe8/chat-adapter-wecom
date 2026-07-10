import { describe, expect, it } from "vitest";
import { decodeThreadId, encodeThreadId } from "./thread-id.js";

describe("WeCom thread IDs", () => {
  it("round-trips IDs containing separators", () => {
    const encoded = encodeThreadId({ type: "group", id: "chat:with/slashes" });
    expect(decodeThreadId(encoded)).toEqual({ type: "group", id: "chat:with/slashes" });
  });

  it("rejects foreign and malformed IDs", () => {
    expect(() => decodeThreadId("slack:C123:thread")).toThrow();
    expect(() => decodeThreadId("wecom:group:not-canonical!")).toThrow();
  });
});
