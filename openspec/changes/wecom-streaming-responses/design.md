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

- **Implement `stream()` rather than overload `postMessage`:** The verified contract routes async iterables through the dedicated `stream()` hook. `postMessage` stays single-shot for plain text/markdown; `stream()` owns the streaming lifecycle and returns a `RawMessage` (never `null`, so the core fallback never runs).
- **Use native WeCom streams rather than post-and-edit:** WeCom supports `aibot_respond_msg` with `stream.id`, which avoids message edit emulation and gives lower latency. Returning `null` to trigger the post+edit fallback is explicitly avoided.
- **Correlate by callback context, not thread:** The existing `AsyncLocalStorage` already preserves `req_id`. A new per-stream context adds `streamId`, accumulated content, deadline, and cancellation state. `req_id` continues to come from `getCurrentRequestId()` inside `stream()`.
- **Keep `req_id` stable and `stream.id` unique:** `req_id` is copied from the incoming callback for every update; `stream.id` is generated once per `stream()` invocation. This matches WeCom's protocol semantics.
- **Accumulate content for each update:** Send accumulated text, not only the newest delta, because WeCom stream updates replace the displayed content associated with the stream.
- **Extract text from `StreamChunk`:** When a chunk is a `MarkdownTextChunk`, append `chunk.text`; for `task_update`/`plan_update`, ignore. Plain string chunks append directly.
- **Always finalize:** On normal completion send `finish: true`. On iterator failure or deadline, send a best-effort final frame and surface the original error to Chat SDK logging.
- **Bound stream state:** Delete completed contexts immediately and expire abandoned contexts after the platform deadline to prevent memory growth.

## Risks / Trade-offs

- [Resolved] Chat SDK stream hook shape is confirmed: dedicated optional `stream()` method on `Adapter` (see Verified contract above). Verified against `chat@4.33.0`.
- [WeCom frame shape] The `aibot_respond_msg` `stream.id` / `finish` frame fields are assumed from WeCom intelligent robot streaming docs → confirm against live traffic / official API reference during implementation before locking the frame builder.
- [Concurrent updates] Multiple callbacks in one group may interleave → use per-response context and serialize writes only at the WebSocket frame boundary.
- [Rate limits] WeCom limits messages per conversation → throttle or coalesce updates if the chosen Chat SDK stream emits too many chunks.
- [Deadline] WeCom ends streams after ten minutes → enforce an internal deadline earlier than the platform limit and finalize deterministically.
- [Disconnect during stream] The socket may disappear while an iterator is active → cancel or stop forwarding and let reconnect handle future callbacks.

## Migration Plan

Consumers already using non-streaming text replies require no configuration change. Once the package version containing this change is installed, `thread.post(asyncIterable)` dispatches to `adapter.stream()` which uses native WeCom streaming; plain string posting remains unchanged and still routes through `postMessage`.

## Open Questions

- [Resolved] Chat SDK exposes a dedicated `stream()` adapter method (not `postMessage` routing). See Verified contract.
- [Open] Decide the minimum update interval/coalescing policy after measuring Chat SDK chunk frequency and WeCom rate limits. `StreamOptions.updateIntervalMs` (default 1000ms) is available as a reference but applies to fallback mode.
