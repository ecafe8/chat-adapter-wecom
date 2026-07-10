## Context

The first change establishes a resident WeCom WebSocket adapter and text message flow. WeCom native streaming requires every update for one callback to use the callback's original `req_id`, while all updates for one rendered message use the same `stream.id`. A group can produce concurrent callbacks, so thread ID alone is not a sufficient correlation key.

## Goals / Non-Goals

**Goals:**

- Support `AsyncIterable` text output from Chat SDK through native WeCom streaming.
- Preserve `req_id` and `stream.id` independently for every concurrent response.
- Send a final frame with `finish: true` for successful and failed streams.
- Stop work on cancellation, disconnect, or the ten-minute WeCom deadline.
- Test the behavior with deterministic fake WebSocket and async iterators.

**Non-Goals:**

- Template cards, button actions, feedback events, or modal interactions.
- Streaming files, images, videos, or mixed media.
- Replacing Chat SDK's public streaming API or requiring consumers to manage WeCom IDs.

## Decisions

- **Use native WeCom streams rather than post-and-edit:** WeCom explicitly supports `aibot_respond_msg` with `stream.id`, which avoids message edit emulation and gives lower latency.
- **Correlate by callback context, not thread:** Store a response context containing `threadId`, `reqId`, `streamId`, start time, and cancellation state. Each incoming callback creates its own context before Chat SDK processing begins.
- **Keep `req_id` stable and `stream.id` unique:** `req_id` is copied from the incoming callback for every update; `stream.id` is generated once per response stream. This matches WeCom's protocol semantics.
- **Accumulate content for each update:** Send the accumulated text, not only the newest delta, because WeCom stream updates replace the displayed content associated with the stream.
- **Always finalize:** On normal completion send `finish: true`. On iterator failure or deadline, send a final best-effort frame and surface the original error to Chat SDK logging.
- **Bound stream state:** Delete completed contexts immediately and expire abandoned contexts after the platform deadline to prevent memory growth.

## Risks / Trade-offs

- [Unknown Chat SDK stream hook shape] The exact current adapter method may differ from assumptions → verify against installed Chat SDK types and official adapter behavior before coding.
- [Concurrent updates] Multiple callbacks in one group may interleave → use per-response context and serialize writes only at the WebSocket frame boundary.
- [Rate limits] WeCom limits messages per conversation → throttle or coalesce updates if the chosen Chat SDK stream emits too many chunks.
- [Deadline] WeCom ends streams after ten minutes → enforce an internal deadline earlier than the platform limit and finalize deterministically.
- [Disconnect during stream] The socket may disappear while an iterator is active → cancel or stop forwarding and let reconnect handle future callbacks.

## Migration Plan

Consumers already using non-streaming text replies require no configuration change. Once the package version containing this change is installed, `thread.post(asyncIterable)` uses native streaming where supported; plain string posting remains unchanged.

## Open Questions

- Confirm whether Chat SDK exposes a dedicated `stream()` adapter method or routes `AsyncIterable` through `postMessage()`.
- Decide the minimum update interval/coalescing policy after measuring Chat SDK chunk frequency and WeCom rate limits.
