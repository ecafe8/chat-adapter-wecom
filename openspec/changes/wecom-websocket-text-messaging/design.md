## Context

The repository currently contains OpenSpec configuration but no adapter implementation. WeCom intelligent robots expose a WebSocket API at `wss://openws.work.weixin.qq.com`. A connection must send `aibot_subscribe`, maintain a heartbeat, process `aibot_msg_callback` and `aibot_event_callback` messages, and reconnect after disconnection. The same robot may have only one active connection.

## Goals / Non-Goals

**Goals:**

- Provide a standalone ESM TypeScript package implementing the Chat SDK adapter contract.
- Support single-chat text messages and group messages that mention the robot.
- Preserve stable thread identity across process restarts.
- Make credentials explicit in configuration while supporting environment fallbacks.
- Keep connection ownership and shutdown behavior deterministic.

**Non-Goals:**

- Streaming responses, which are handled by the separate `wecom-streaming-responses` change.
- Template-card actions, files, reactions, message history, or message editing/deletion.
- Multi-tenant credential storage or multiple active connections for one robot.

## Decisions

- **Use a resident WebSocket connection:** WeCom long connection avoids public webhook and XML encryption requirements and is required for low-latency group messaging. A traditional HTTP callback was rejected for this phase because it adds encryption and public ingress complexity.
- **Use `botId` and `secret` configuration with environment fallback:** The factory accepts explicit values and falls back to `WECOM_BOT_ID` and `WECOM_BOT_SECRET`. Explicit values win, missing values fail fast, and secrets are never logged.
- **Own the connection in the adapter lifecycle:** `initialize()` starts the connection and `disconnect()` stops heartbeat, reconnect timers, and the socket. This matches Chat SDK shutdown semantics and makes the adapter usable by resident applications.
- **Encode thread IDs with URL-safe segments:** Use `wecom:single:<userid>` and `wecom:group:<chatid>`, with encoding/decoding validation so platform IDs cannot corrupt the separator format.
- **Use `msgid` for idempotency:** A bounded in-memory de-duplication set prevents duplicate callback delivery in one process. Durable cross-process idempotency is deferred until a state integration is defined.
- **Use a small transport boundary:** Keep WebSocket protocol framing, request IDs, and reconnect logic separate from Chat SDK message parsing and posting so protocol tests do not require a live Chat instance.

## Risks / Trade-offs

- [Single active connection] Multiple application instances can evict each other from WeCom → document single-instance operation and expose connection state in logs without exposing credentials.
- [In-memory de-duplication] Restarted processes can process a repeated callback → document the limitation and leave a state-backed idempotency extension for a later change.
- [Group semantics] WeCom only sends group messages that mention the robot → document that subscribing to a thread cannot receive all group traffic.
- [Platform Markdown subset] WeCom does not support all Markdown → render supported content and fall back to plain text where necessary.

## Migration Plan

No migration is required. Consumers install the package, configure `WECOM_BOT_ID` and `WECOM_BOT_SECRET` or pass equivalent constructor options, register the adapter with Chat SDK, and run one resident process per robot.

## Open Questions

- Confirm the final WebSocket client dependency and supported Node.js versions before package publication.
- Confirm how Chat SDK handles adapter initialization failures and whether consumers need an explicit `await chat.initialize()` recommendation.
