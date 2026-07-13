import { describe, expect, it, vi } from "vitest";
import { ConsoleLogger, type StreamChunk } from "chat";
import { WeComStreamer, extractStreamText } from "./streaming.js";
import type { WeComStreamFrame } from "./types.js";

type SendFn = (frame: WeComStreamFrame | Record<string, unknown>) => void;

function createStreamer(opts: {
  reqId?: string;
  deadlineMs?: number;
  coalesceMs?: number;
  onDone?: (id: string) => void;
  sendFn?: SendFn;
}) {
  const sent: WeComStreamFrame[] = [];
  const onDone = opts.onDone ?? (() => {});
  const sendFn: SendFn =
    opts.sendFn ??
    ((frame) => {
      sent.push(frame as WeComStreamFrame);
    });
  const streamer = new WeComStreamer({
    threadId: "wecom:group:g1",
    reqId: opts.reqId ?? "req-1",
    protocol: { send: sendFn },
    logger: new ConsoleLogger("silent"),
    deadlineMs: opts.deadlineMs ?? 600_000,
    coalesceMs: opts.coalesceMs ?? 0,
    onDone,
  });
  return { streamer, sent, onDone };
}

async function* fromChunks(chunks: Array<string | StreamChunk>): AsyncIterable<string | StreamChunk> {
  for (const chunk of chunks) yield chunk;
}

describe("WeComStreamer", () => {
  it("sends accumulated content frames with stable req_id and stream.id, finishing with finish:true (4.1)", async () => {
    const { streamer, sent } = createStreamer({});
    await streamer.run(fromChunks(["a", "b", "c"]));
    const streamIds = new Set(sent.map((f) => f.body.stream_id));
    expect(streamIds.size).toBe(1);
    expect(sent.every((f) => f.headers.req_id === "req-1")).toBe(true);
    expect(sent.every((f) => f.cmd === "aibot_respond_msg")).toBe(true);
    expect(sent.every((f) => f.body.msgtype === "markdown")).toBe(true);
    expect(sent.at(-1)?.body.finish).toBe(true);
    expect(sent.slice(0, -1).every((f) => f.body.finish === false)).toBe(true);
    expect(sent.map((f) => f.body.markdown.content)).toEqual(["a", "ab", "abc", "abc"]);
    expect(sent.at(-1)?.body.stream_id).toBe(streamer.streamId);
  });

  it("uses a different stream.id per response and keeps content isolated (4.2)", async () => {
    const a = createStreamer({ reqId: "req-a", sendFn: (f) => a.sent.push(f as WeComStreamFrame) });
    const b = createStreamer({ reqId: "req-b", sendFn: (f) => b.sent.push(f as WeComStreamFrame) });
    await Promise.all([a.streamer.run(fromChunks(["1", "2"])), b.streamer.run(fromChunks(["x", "y"]))]);
    expect(a.streamer.streamId).not.toBe(b.streamer.streamId);
    expect(a.sent.every((f) => f.headers.req_id === "req-a")).toBe(true);
    expect(b.sent.every((f) => f.headers.req_id === "req-b")).toBe(true);
    expect(a.sent.every((f) => f.body.stream_id === a.streamer.streamId)).toBe(true);
    expect(b.sent.every((f) => f.body.stream_id === b.streamer.streamId)).toBe(true);
    expect(a.sent.at(-1)?.body.markdown.content).toBe("12");
    expect(b.sent.at(-1)?.body.markdown.content).toBe("xy");
  });

  it("sends a best-effort finish frame then rethrows when the iterator fails (4.3)", async () => {
    const { streamer, sent } = createStreamer({});
    async function* failing(): AsyncIterable<string> {
      yield "partial";
      throw new Error("iterator failed");
    }
    await expect(streamer.run(failing())).rejects.toThrow("iterator failed");
    expect(sent.at(-1)?.body.finish).toBe(true);
    expect(sent.at(-1)?.body.markdown.content).toBe("partial");
  });

  it("finalizes with a finish frame when the deadline is exceeded (4.3)", async () => {
    const { streamer, sent } = createStreamer({ deadlineMs: 10 });
    async function* slow(): AsyncIterable<string> {
      yield "hello";
      await new Promise((r) => setTimeout(r, 40));
    }
    await streamer.run(slow());
    expect(sent.at(-1)?.body.finish).toBe(true);
    expect(sent.at(-1)?.body.markdown.content).toBe("hello");
  });

  it("does not send a finish frame on disconnect and releases context (4.3)", async () => {
    let done = false;
    const { streamer, sent } = createStreamer({ onDone: () => { done = true; } });
    let resolveNext: () => void;
    async function* hanging(): AsyncIterable<string> {
      yield "hi";
      await new Promise<void>((resolve) => { resolveNext = resolve; });
    }
    const runPromise = streamer.run(hanging());
    await vi.waitFor(() => expect(sent.length).toBeGreaterThanOrEqual(1));
    streamer.cancel("disconnect");
    resolveNext!();
    await runPromise;
    expect(sent.every((f) => !f.body.finish)).toBe(true);
    expect(done).toBe(true);
  });

  it("extracts text from strings and markdown_text, ignores other chunks (4.5)", () => {
    expect(extractStreamText("plain")).toBe("plain");
    expect(extractStreamText({ type: "markdown_text", text: "md" })).toBe("md");
    expect(extractStreamText({ type: "task_update", id: "t1", status: "in_progress", title: "T" } as StreamChunk)).toBeNull();
    expect(extractStreamText({ type: "plan_update", title: "P" } as StreamChunk)).toBeNull();
  });

  it("appends string and markdown_text chunks, ignoring structured chunks (4.5)", async () => {
    const { streamer, sent } = createStreamer({});
    await streamer.run(fromChunks([
      "a",
      { type: "markdown_text", text: "b" },
      { type: "task_update", id: "t", status: "pending", title: "T" } as StreamChunk,
      { type: "plan_update", title: "P" } as StreamChunk,
      "c",
    ]));
    expect(sent.at(-1)?.body.markdown.content).toBe("abc");
  });

  it("calls onDone on normal completion (leak cleanup 4.6)", async () => {
    let doneId: string | undefined;
    const { streamer } = createStreamer({ onDone: (id) => { doneId = id; } });
    await streamer.run(fromChunks(["x"]));
    expect(doneId).toBe(streamer.streamId);
  });

  it("calls onDone after cancellation (leak cleanup 4.6)", async () => {
    let doneId: string | undefined;
    const { streamer } = createStreamer({ onDone: (id) => { doneId = id; }, deadlineMs: 10 });
    async function* slow(): AsyncIterable<string> {
      yield "x";
      await new Promise((r) => setTimeout(r, 40));
    }
    await streamer.run(slow());
    expect(doneId).toBe(streamer.streamId);
  });

  it("coalesces rapid chunks into fewer frames (3.6)", async () => {
    const { streamer, sent } = createStreamer({ coalesceMs: 5 });
    await streamer.run(fromChunks(["a", "b", "c", "d"]));
    const updates = sent.filter((f) => !f.body.finish);
    expect(updates.length).toBeLessThanOrEqual(3);
    expect(sent.at(-1)?.body.finish).toBe(true);
    expect(sent.at(-1)?.body.markdown.content).toBe("abcd");
  });
});
