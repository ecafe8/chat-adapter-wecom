## 1. Contract verification

- [ ] 1.1 Inspect the installed Chat SDK types and official adapter implementations to confirm the exact streaming adapter hook and `AsyncIterable` behavior.
- [ ] 1.2 Record the confirmed Chat SDK version and streaming contract in package documentation and design notes.

## 2. Correlation and stream state

- [ ] 2.1 Define per-response context for callback `req_id`, generated `stream.id`, thread ID, accumulated content, deadline, and cancellation state.
- [ ] 2.2 Bind callback context to Chat SDK processing without using thread ID as the sole correlation key.
- [ ] 2.3 Implement bounded cleanup for completion, error, cancellation, deadline, and socket loss.

## 3. Native WeCom streaming

- [ ] 3.1 Implement initial, incremental, and final `aibot_respond_msg` stream frames.
- [ ] 3.2 Implement accumulated-content rendering and safe text/Markdown handling for stream updates.
- [ ] 3.3 Implement deadline enforcement at or below ten minutes.
- [ ] 3.4 Implement iterator error handling, cancellation, transport failure handling, and finalization.
- [ ] 3.5 Add coalescing or throttling if required by measured WeCom rate limits.

## 4. Tests

- [ ] 4.1 Add protocol tests for stream frame shape, stable `req_id`, stable `stream.id`, and `finish` transitions.
- [ ] 4.2 Add concurrent-stream tests proving request IDs and content never cross between group messages.
- [ ] 4.3 Add tests for normal completion, iterator failure, cancellation, deadline, and connection loss.
- [ ] 4.4 Add Chat SDK integration tests covering `thread.post(asyncIterable)` or the confirmed streaming hook.
- [ ] 4.5 Add leak-oriented tests proving completed and abandoned stream contexts are cleaned up.

## 5. Documentation and release readiness

- [ ] 5.1 Document native streaming behavior, response deadlines, limitations, and cancellation semantics.
- [ ] 5.2 Update the feature matrix and usage examples with a streaming example.
- [ ] 5.3 Document rate limits and any configured coalescing interval.
- [ ] 5.4 Run typecheck, unit tests, integration tests, coverage, build, and package-content verification.
- [ ] 5.5 Update changelog and version metadata for the streaming capability.
