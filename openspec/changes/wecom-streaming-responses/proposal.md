## Why

WeCom intelligent robot long connections support native streaming, but each stream must preserve the originating callback `req_id` and use one stable `stream.id`. Chat SDK consumers need this behavior exposed through the normal thread posting API without response correlation breaking under concurrent group conversations.

## What Changes

- Add native WeCom streaming support for Chat SDK text streams.
- Correlate each Chat SDK response stream with the originating WeCom callback request ID.
- Generate and preserve a stable WeCom stream ID for each response.
- Send incremental updates and a final `finish: true` frame.
- Enforce the WeCom ten-minute stream lifetime and handle cancellation/failure.
- Add concurrency, timeout, protocol, integration, and documentation coverage.

## Capabilities

### New Capabilities

- `wecom-streaming`: Stream Chat SDK text output through WeCom `aibot_respond_msg` frames.
- `wecom-response-correlation`: Preserve callback and stream context safely across concurrent messages.

### Modified Capabilities

- `wecom-websocket-connection`: Extend the transport to support correlated streaming response frames.
- `wecom-text-messaging`: Allow thread posting to select native streaming when given an async text stream.

## Impact

- Extends the adapter's WebSocket transport and response dispatch layers.
- Adds stream state and cancellation handling to the adapter runtime.
- Requires integration with Chat SDK's streaming adapter method or equivalent postable stream path.
- Adds no new credentials; it uses the existing `WECOM_BOT_ID` and `WECOM_BOT_SECRET` configuration.
- Does not add template-card support; that remains a later change.
