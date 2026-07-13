## Context

The first change established a resident WeCom WebSocket adapter and text message flow. That foundation is now implemented: the WebSocket transport (`protocol.ts`) subscribes, heartbeats, reconnects, and exposes a ready-state-guarded `send()`; `postMessage` sends a single non-streaming `aibot_respond_msg` markdown frame; and callback `req_id` correlation is carried through the async call chain via `AsyncLocalStorage` (`request-context.ts`), with a test proving concurrent callbacks to the same thread do not clobber each other's `req_id`.

WeCom native streaming builds on this. Every update for one callback must use the callback's original `req_id`, while all updates for one rendered message use the same `stream.id`. A group can produce concurrent callbacks, so thread ID alone is not a sufficient correlation key.

## Verified Chat SDK streaming contract

Inspected against installed `chat@4.33.0` types (`node_modules/chat/dist/messages-x-*.d.ts`). Chat SDK exposes a **dedicated optional `stream()` method on the `Adapter` interface** — it does **not** route `AsyncIterable` through `postMessage`:

```ts
stream?(threadId: string, textStream: AsyncIterable<string | StreamChunk>, options?: StreamOptions): Promise<RawMessage<TRawMessage> | null>;
```

- `StreamChunk = MarkdownTextChunk | TaskUpdateChunk | PlanUpdateChunk`. Adapters that do not support structured chunks extract text from `markdown_text` chunks and ignore `task_update`/`plan_update`.
- Returning `null` before consuming chunks delegates to Chat SDK's built-in post+edit fallback for the thread. WeCom implements native streaming, so this adapter returns a real `RawMessage` instead of `null`.
- `StreamOptions.updateIntervalMs` (default 1000ms) is documented for fallback mode (GChat/Teams); WeCom uses native frames and applies its own coalescing when needed.
- `Thread.post(asyncIterable)` is the consumer-facing entry point; the SDK dispatches it to `adapter.stream()` when the method exists.

## Verified WeCom stream frame protocol

Confirmed against the official WeCom docs (智能机器人长连接, `developer.work.weixin.qq.com/document/path/101463`, and 接收消息, `.../100719`). An earlier implementation incorrectly reused the non-streaming `markdown` message shape with a flat `stream_id` field, which WeCom rendered as independent messages instead of updates to one stream (each frame lacked the fields WeCom needs to correlate them). The confirmed request shape is:

```json
{
  "cmd": "aibot_respond_msg",
  "headers": { "req_id": "REQUEST_ID" },
  "body": {
    "msgtype": "stream",
    "stream": {
      "id": "STREAMID",
      "finish": false,
      "content": "accumulated text so far"
    }
  }
}
```

- `body.msgtype` must be `"stream"` (not `"markdown"`); the stream payload is nested under `body.stream`, not at the top level.
- `body.stream.id` correlates frames into one message: the **first** use of a `stream.id` creates the message, subsequent uses with the same id **update** it, and `finish: true` ends it (message becomes non-updatable).
- `body.stream.content` carries the full accumulated content on every frame (WeCom replaces the displayed content, it does not append deltas).
- All frames for one response reuse the callback's `headers.req_id`; `stream.id` is generated once per response and is independent of `req_id`.
- WeCom enforces a **10-minute** limit from the first stream frame to `finish: true`, after which the message auto-ends — matches the adapter's internal deadline (default 9 min, clamped to ≤10 min).
- Per-conversation send-rate limit: **30 messages/minute, 1000/hour**, counting both replies and proactive pushes. This motivates coalescing stream updates rather than sending on every chunk.
- The non-streaming `markdown` message shape (`{ msgtype: "markdown", markdown: { content } }`) used by `postMessage` is correct and unrelated to the stream shape above — the two must not be conflated.

**Independent cross-check:** The community-maintained `@wecom/aibot-node-sdk` (`github.com/WecomTeam/aibot-node-sdk`, not an npm dependency of this package — reference only) exposes the same shape as its `StreamReplyBody` type: `{ msgtype: "stream", stream: { id, finish?, content?, msg_item?, feedback? } }`, confirming the fix above independently of the official docs. Two fields it supports that this adapter does not yet use: `stream.content` is capped at **20480 bytes** by WeCom (not currently enforced/truncated here — a future hardening item), and `stream.msg_item`/`stream.feedback` (inline images on the final frame; user-feedback correlation id) are out of scope for this change (see Non-Goals).

## Goals / Non-Goals

**Goals:**

- Implement the `stream()` adapter method to consume `AsyncIterable<string | StreamChunk>` and emit native WeCom stream frames.
- Preserve `req_id` (from `AsyncLocalStorage`, already in place) and generate a stable `stream.id` independently for every concurrent response.
- Send accumulated content per update and a final frame with `finish: true` for successful and failed streams.
- Stop work on cancellation, disconnect, or the ten-minute WeCom deadline.
- Handle `StreamChunk` by extracting text from `markdown_text` and ignoring non-text chunk types.
- Test the behavior with deterministic fake WebSocket and async iterators.

**Non-Goals:**

- Template cards, button actions, feedback events, or modal interactions.
- Streaming files, images, videos, or mixed media.
- Rendering `task_update`/`plan_update` chunks as rich cards (text extraction only).
- Replacing Chat SDK's public streaming API or requiring consumers to manage WeCom IDs.

## Decisions

- **Implement `stream()` rather than overload `postMessage`:** The verified contract routes async iterables through the dedicated `stream()` hook. `postMessage` stays single-shot for plain text/markdown (`msgtype: "markdown"`); `stream()` owns the streaming lifecycle using the distinct `msgtype: "stream"` shape and returns a `RawMessage` (never `null`, so the core fallback never runs).
- **Use native WeCom streams rather than post-and-edit:** WeCom supports `aibot_respond_msg` with `body.stream.id`, which avoids message edit emulation and gives lower latency. Returning `null` to trigger the post+edit fallback is explicitly avoided.
- **Correlate by callback context, not thread:** The existing `AsyncLocalStorage` already preserves `req_id`. A new per-stream context adds `streamId`, accumulated content, deadline, and cancellation state. `req_id` continues to come from `getCurrentRequestId()` inside `stream()`.
- **Keep `req_id` stable and `stream.id` unique:** `req_id` is copied from the incoming callback for every update; `stream.id` is generated once per `stream()` invocation. This matches WeCom's confirmed protocol semantics.
- **Accumulate content for each update:** Send accumulated text, not only the newest delta, because WeCom stream updates replace the displayed content associated with the stream.
- **Extract text from `StreamChunk`:** When a chunk is a `MarkdownTextChunk`, append `chunk.text`; for `task_update`/`plan_update`, ignore. Plain string chunks append directly.
- **Always finalize:** On normal completion send `finish: true`. On iterator failure or deadline, send a best-effort final frame and surface the original error to Chat SDK logging.
- **Bound stream state:** Delete completed contexts immediately and expire abandoned contexts after the platform deadline to prevent memory growth.
- **Coalesce by default (1000ms):** Given the documented 30/min, 1000/hour per-conversation rate limit, the default `streamCoalesceMs` batches rapid chunks instead of sending on every chunk.

## Risks / Trade-offs

- [Resolved] Chat SDK stream hook shape is confirmed: dedicated optional `stream()` method on `Adapter` (see Verified Chat SDK streaming contract above). Verified against `chat@4.33.0`.
- [Resolved] WeCom `aibot_respond_msg` stream frame shape is confirmed against official docs: `msgtype: "stream"`, `body.stream: { id, finish, content }` (see Verified WeCom stream frame protocol above). The initial implementation used the wrong shape (`markdown` msgtype + flat `stream_id`), which WeCom rendered as separate messages instead of stream updates — fixed.
- [Concurrent updates] Multiple callbacks in one group may interleave → use per-response context and serialize writes only at the WebSocket frame boundary.
- [Rate limits] WeCom limits messages per conversation to 30/min, 1000/hour (confirmed) → default coalescing interval of 1000ms batches updates; tune `WECOM_STREAM_COALESCE_MS` for higher-frequency sources.
- [Deadline] WeCom ends streams after ten minutes (confirmed) → enforce an internal deadline earlier than the platform limit and finalize deterministically.
- [Disconnect during stream] The socket may disappear while an iterator is active → cancel or stop forwarding and let reconnect handle future callbacks.

## Migration Plan

Consumers already using non-streaming text replies require no configuration change. Once the package version containing this change is installed, `thread.post(asyncIterable)` dispatches to `adapter.stream()` which uses native WeCom streaming; plain string posting remains unchanged and still routes through `postMessage`.

## Open Questions

- [Resolved] Chat SDK exposes a dedicated `stream()` adapter method (not `postMessage` routing). See Verified Chat SDK streaming contract.
- [Resolved] WeCom stream frame shape and rate limits confirmed against official docs (30/min, 1000/hour per conversation; 10-minute stream lifetime). Default `streamCoalesceMs` set to 1000ms accordingly; adjustable per deployment if real-world usage shows it's too conservative or too aggressive.
