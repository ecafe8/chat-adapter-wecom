## 1. Contract verification

- [x] 1.1 Inspect the installed Chat SDK types and official adapter implementations to confirm the exact streaming adapter hook and `AsyncIterable` behavior. **Verified against `chat@4.33.0`:** Chat SDK exposes a dedicated optional `stream()` method on `Adapter` — `stream?(threadId, textStream: AsyncIterable<string | StreamChunk>, options?: StreamOptions): Promise<RawMessage | null>`. It does not route `AsyncIterable` through `postMessage`. `StreamChunk = MarkdownTextChunk | TaskUpdateChunk | PlanUpdateChunk`; adapters extract text from `markdown_text` and ignore others. Returning `null` delegates to the core post+edit fallback.
- [x] 1.2 Record the confirmed Chat SDK version and streaming contract in design notes. **Recorded in `design.md` under "Verified Chat SDK streaming contract".**

## 2. Correlation and stream state

- [x] 2.1 Define per-response context for callback `req_id`, generated `stream.id`, thread ID, accumulated content, deadline, and cancellation state. **`req_id` correlation already implemented via `AsyncLocalStorage` in `request-context.ts` (`runWithRequestId`/`getCurrentRequestId`).** **Stream-specific context (`streamId`, accumulated content, deadline, cancellation) implemented in `streaming.ts` `WeComStreamer`.**
- [x] 2.2 Bind callback context to Chat SDK processing without using thread ID as the sole correlation key. **Done — `processFrame` wraps `chat.processMessage` in `runWithRequestId(callback.headers.req_id, ...)`; `postMessage`/`stream()` read `getCurrentRequestId()`. Covered by concurrent-callback tests in `adapter.test.ts`.**
- [x] 2.3 Implement bounded cleanup for completion, error, cancellation, deadline, and socket loss for stream contexts. **Done — `WeComStreamer.cleanup()` removes context via `onDone`; `WeComAdapter.cancelActiveStreams()` cancels all active streams on `onDisconnect`/`disconnect()`; `stream()` removes the context from `activeStreams` on completion. Covered by leak-cleanup tests in `streaming.test.ts`/`adapter.test.ts`.**

## 3. Native WeCom streaming

- [x] 3.1 Implement the `stream()` adapter method (`Adapter.stream`) consuming `AsyncIterable<string | StreamChunk>`; do not return `null` (avoid the post+edit fallback). **Implemented in `adapter.ts` `stream()`; returns `RawMessage` with the stream id.**
- [x] 3.2 Implement initial, incremental, and final `aibot_respond_msg` stream frames with a generated, stable `stream.id` and `finish: true` on the final frame. **Implemented in `streaming.ts` `sendFrame()`; frame shape in `types.ts` `WeComStreamFrame` — confirmed against official docs as `{ msgtype: "stream", stream: { id, finish, content } }` (an earlier revision incorrectly reused the `markdown` shape with a flat `stream_id`, which WeCom rendered as separate messages; fixed).**
- [x] 3.3 Implement accumulated-content rendering and safe text/Markdown handling for stream updates. Extract text from `MarkdownTextChunk`; ignore `task_update`/`plan_update`; append plain string chunks directly. **Implemented in `streaming.ts` `extractStreamText()` + `run()` accumulation loop.**
- [x] 3.4 Implement deadline enforcement at or below ten minutes (internal deadline earlier than the platform limit). **Implemented via `streamDeadlineMs` (default 9 min, clamped to ≤10 min) in `config.ts` + `WeComStreamer.startDeadline()`/`cancel("deadline")`.**
- [x] 3.5 Implement iterator error handling, cancellation, transport failure handling, and finalization (best-effort final frame when usable). **Implemented in `WeComStreamer.run()` try/catch/finally and `cancel()`; `onDisconnect` cancels active streams on socket loss.**
- [x] 3.6 Add coalescing or throttling if required by measured WeCom rate limits (reference: `StreamOptions.updateIntervalMs` default 1000ms). **Implemented configurable coalescing via `streamCoalesceMs` (default 1000ms, matching the confirmed WeCom per-conversation limit of 30 msgs/min) in `config.ts` + `WeComStreamer.scheduleFlush()`; dedup guard skips no-op non-final frames.**

## 4. Tests

- [x] 4.0 Existing protocol/adapter tests cover subscription, heartbeat, reconnect, `send()` ready-state guard, and concurrent-callback `req_id` isolation. **Keep as regression.**
- [x] 4.1 Add protocol tests for stream frame shape, stable `req_id`, stable `stream.id`, and `finish` transitions. **`streaming.test.ts` "sends accumulated content frames with stable req_id and stream.id".**
- [x] 4.2 Add concurrent-stream tests proving request IDs, stream IDs, and content never cross between group messages. **`streaming.test.ts` "uses a different stream.id per response" + `adapter.test.ts` "keeps concurrent streams isolated by req_id and stream_id".**
- [x] 4.3 Add tests for normal completion, iterator failure, cancellation, deadline, and connection loss. **`streaming.test.ts` covers completion (4.1), iterator failure, deadline, and disconnect cancellation.**
- [x] 4.4 Add Chat SDK integration tests covering `adapter.stream()` (and the `Thread.post(asyncIterable)` → `stream()` dispatch path). **`adapter.test.ts` "routes async iterables through adapter.stream() within a callback context".**
- [x] 4.5 Add `StreamChunk` tests: plain string chunks, `markdown_text` text extraction, and ignored `task_update`/`plan_update`. **`streaming.test.ts` "extracts text from strings and markdown_text" + "appends string and markdown_text chunks".**
- [x] 4.6 Add leak-oriented tests proving completed and abandoned stream contexts are cleaned up. **`streaming.test.ts` "calls onDone on normal completion"/"calls onDone after cancellation" + `adapter.test.ts` "removes stream contexts after completion".**

## 5. Documentation and release readiness

- [x] 5.1 Document native streaming behavior, response deadlines, limitations, and cancellation semantics. **Documented in README "Streaming replies" section.**
- [x] 5.2 Update the feature matrix and usage examples with a streaming example. **Feature matrix updated to "Supported via `thread.post(asyncIterable)`"; streaming example added.**
- [x] 5.3 Document rate limits and any configured coalescing interval. **`WECOM_STREAM_COALESCE_MS` / `WECOM_STREAM_DEADLINE_MS` documented in env table and `.env.example`; confirmed WeCom per-conversation limit (30/min, 1000/hour) documented in `design.md`.**
- [x] 5.4 Run typecheck, unit tests, integration tests, coverage, build, and package-content verification. **All pass: `tsc --noEmit`, 25 vitest tests, v8 coverage, `tsup` build, `npm pack --dry-run` (6 files).**
- [x] 5.5 Update changelog and version metadata for the streaming capability. **Version bumped to 0.2.0; `CHANGELOG.md` added.**
