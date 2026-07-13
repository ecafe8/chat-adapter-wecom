# Changelog

## 0.2.0

### Added

- Native WeCom streaming via the Chat SDK `Adapter.stream()` hook. Posting an `AsyncIterable<string>` to a thread (e.g. an AI SDK `textStream`) now emits `aibot_respond_msg` stream frames (`{ msgtype: "stream", stream: { id, finish, content } }`, confirmed against official WeCom docs): an initial frame, incremental updates carrying accumulated content, and a final `finish: true` frame.
- Stable per-stream `stream.id` and preserved callback `req_id`, keeping concurrent group callbacks isolated.
- Stream deadline enforcement (default 9 minutes, clamped to the WeCom 10-minute limit) with best-effort final-frame finalization.
- Configurable update coalescing (`WECOM_STREAM_COALESCE_MS`, default 1000 ms) to stay under WeCom's 30 messages/minute (1000/hour) per-conversation limit.
- Cancellation and cleanup on iterator failure, deadline, or WebSocket disconnect.
- `StreamChunk` handling: `markdown_text` and plain string chunks are forwarded; `task_update` and `plan_update` are ignored.

### Changed

- The `WeComProtocolClient` now notifies the adapter on socket disconnect via `onDisconnect`, so active streams are cancelled on transport loss.
- Feature matrix: "Native streaming" is now "Supported via `thread.post(asyncIterable)`".

### Environment Variables

- Added `WECOM_STREAM_DEADLINE_MS` (default 540000).
- Added `WECOM_STREAM_COALESCE_MS` (default 1000).

## 0.1.0

- Initial WeCom intelligent robot WebSocket adapter for Chat SDK: single-chat and group `@robot` text, Markdown replies, callback de-duplication, heartbeat, and reconnect.
