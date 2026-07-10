## Context

The repository currently contains OpenSpec configuration but no adapter implementation. WeCom intelligent robots expose a WebSocket API at `wss://openws.work.weixin.qq.com`. A connection must send `aibot_subscribe`, maintain a heartbeat, process `aibot_msg_callback` and `aibot_event_callback` messages, and reconnect after disconnection. The same robot may have only one active connection. The reference community adapter `wong2/chat-adapter-weixin` uses a root-level npm package, a dedicated runtime-state wrapper around Chat SDK's `StateAdapter`, background transport processing, and focused protocol/unit/integration tests.

## Goals / Non-Goals

**Goals:**

- Provide a standalone ESM TypeScript package implementing the Chat SDK adapter contract.
- Keep the package at repository root with `src/`, `package.json`, `README.md`, and build/test configuration.
- Support single-chat text messages and group messages that mention the robot.
- Preserve stable thread identity across process restarts.
- Make credentials explicit in configuration while supporting environment fallbacks.
- Provide a checked-in environment template that contains placeholders only.
- Persist callback de-duplication and response context through Chat SDK `StateAdapter`.
- Keep connection ownership and shutdown behavior deterministic.
- Provide a local Next.js App Router example for manual end-to-end testing.
- Provide a framework-light Hono/Node.js example for the recommended resident-process deployment model.

**Non-Goals:**

- Streaming responses, which are handled by the separate `wecom-streaming-responses` change.
- Template-card actions, files, reactions, message history, or message editing/deletion.
- Multi-tenant credential storage or multiple active connections for one robot.

## Decisions

- **Use a resident WebSocket connection:** WeCom long connection avoids public webhook and XML encryption requirements and is required for low-latency group messaging. A traditional HTTP callback was rejected for this phase because it adds encryption and public ingress complexity.
- **Use `botId` and `secret` configuration with environment fallback:** The factory accepts explicit values and falls back to `WECOM_BOT_ID` and `WECOM_BOT_SECRET`. Explicit values win, missing values fail fast, and secrets are never logged.
- **Ship `.env.example` as setup documentation:** The template lists `WECOM_BOT_ID` and `WECOM_BOT_SECRET` plus supported optional tuning variables with safe placeholder values. It SHALL never contain a real BotID, Secret, or production credential.
- **Run transport processing in the background:** `initialize()` stores the `ChatInstance`, creates the runtime state wrapper, and starts a background WebSocket loop. It does not block on the lifetime of the connection. `disconnect()` aborts the loop and awaits its completion.
- **Encode thread IDs with URL-safe segments:** Use `wecom:single:<userid>` and `wecom:group:<chatid>`, with encoding/decoding validation so platform IDs cannot corrupt the separator format.
- **Use `StateAdapter` for idempotency and runtime context:** Store processed `msgid` keys and callback request context with TTLs. This preserves behavior across restarts and supports distributed deployments without introducing a second storage abstraction.
- **Use a small transport boundary:** Keep WebSocket protocol framing, request IDs, and reconnect logic separate from Chat SDK message parsing and posting so protocol tests do not require a live Chat instance.
- **Use a server-only Next.js singleton in the example:** The example initializes one Chat instance in `src/lib/bot.ts`, stores it on `globalThis` for development reload stability, and exposes only status data from a route handler. It is explicitly a resident-process test app, not a serverless deployment pattern.
- **Use Hono for the resident example:** `examples/hono` follows Hono's Node adapter pattern with `serve(app)`, initializes Chat SDK before serving HTTP, exposes `/health`, and shuts down Chat SDK before closing the HTTP server on SIGINT/SIGTERM.

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
