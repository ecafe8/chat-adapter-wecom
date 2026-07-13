## 1. Contract verification

- [x] 1.1 Inspect the installed Chat SDK types and official adapter implementations to confirm the exact streaming adapter hook and `AsyncIterable` behavior. **Verified against `chat@4.33.0`:** Chat SDK exposes a dedicated optional `stream()` method on `Adapter` — `stream?(threadId, textStream: AsyncIterable<string | StreamChunk>, options?: StreamOptions): Promise<RawMessage | null>`. It does not route `AsyncIterable` through `postMessage`. `StreamChunk = MarkdownTextChunk | TaskUpdateChunk | PlanUpdateChunk`; adapters extract text from `markdown_text` and ignore others. Returning `null` delegates to the core post+edit fallback.
- [x] 1.2 Record the confirmed Chat SDK version and streaming contract in design notes. **Recorded in `design.md` under "Verified Chat SDK streaming contract".**

## 2. Correlation and stream state

- [x] 2.1 Define per-response context for callback `req_id`, generated `stream.id`, thread ID, accumulated content, deadline, and cancellation state. **`req_id` correlation already implemented via `AsyncLocalStorage` in `request-context.ts` (`runWithRequestId`/`getCurrentRequestId`).** Remaining: add stream-specific context (`streamId`, accumulated content, deadline, cancellation).
- [x] 2.2 Bind callback context to Chat SDK processing without using thread ID as the sole correlation key. **Done — `processFrame` wraps `chat.processMessage` in `runWithRequestId(callback.headers.req_id, ...)`; `postMessage` reads `getCurrentRequestId()`. Covered by the concurrent-callback test in `adapter.test.ts`.**
- [ ] 2.3 Implement bounded cleanup for completion, error, cancellation, deadline, and socket loss for stream contexts.

## 3. Native WeCom streaming

- [ ] 3.1 Implement the `stream()` adapter method (`Adapter.stream`) consuming `AsyncIterable<string | StreamChunk>`; do not return `null` (avoid the post+edit fallback).
- [ ] 3.2 Implement initial, incremental, and final `aibot_respond_msg` stream frames with a generated, stable `stream.id` and `finish: true` on the final frame.
- [ ] 3.3 Implement accumulated-content rendering and safe text/Markdown handling for stream updates. Extract text from `MarkdownTextChunk`; ignore `task_update`/`plan_update`; append plain string chunks directly.
- [ ] 3.4 Implement deadline enforcement at or below ten minutes (internal deadline earlier than the platform limit).
- [ ] 3.5 Implement iterator error handling, cancellation, transport failure handling, and finalization (best-effort final frame when usable).
- [ ] 3.6 Add coalescing or throttling if required by measured WeCom rate limits (reference: `StreamOptions.updateIntervalMs` default 1000ms).

## 4. Tests

- [x] 4.0 Existing protocol/adapter tests cover subscription, heartbeat, reconnect, `send()` ready-state guard, and concurrent-callback `req_id` isolation. **Keep as regression.**
- [ ] 4.1 Add protocol tests for stream frame shape, stable `req_id`, stable `stream.id`, and `finish` transitions.
- [ ] 4.2 Add concurrent-stream tests proving request IDs, stream IDs, and content never cross between group messages.
- [ ] 4.3 Add tests for normal completion, iterator failure, cancellation, deadline, and connection loss.
- [ ] 4.4 Add Chat SDK integration tests covering `adapter.stream()` (and the `Thread.post(asyncIterable)` → `stream()` dispatch path).
- [ ] 4.5 Add `StreamChunk` tests: plain string chunks, `markdown_text` text extraction, and ignored `task_update`/`plan_update`.
- [ ] 4.6 Add leak-oriented tests proving completed and abandoned stream contexts are cleaned up.

## 5. Documentation and release readiness

- [ ] 5.1 Document native streaming behavior, response deadlines, limitations, and cancellation semantics.
- [ ] 5.2 Update the feature matrix and usage examples with a streaming example.
- [ ] 5.3 Document rate limits and any configured coalescing interval.
- [ ] 5.4 Run typecheck, unit tests, integration tests, coverage, build, and package-content verification.
- [ ] 5.5 Update changelog and version metadata for the streaming capability.
