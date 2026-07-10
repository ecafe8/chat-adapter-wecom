## Why

Chat SDK currently has no adapter for WeCom intelligent robots. A persistent WebSocket adapter is needed to receive direct messages and group messages that mention the robot without requiring a public webhook endpoint.

## What Changes

- Add an npm-packaged WeCom Chat SDK adapter based on the intelligent robot WebSocket API.
- Add explicit adapter configuration for `botId` and long-connection `secret`.
- Support environment fallbacks through `WECOM_BOT_ID` and `WECOM_BOT_SECRET`.
- Establish, authenticate, maintain, reconnect, and shut down the WebSocket connection.
- Parse single-chat and group `@robot` text callbacks into Chat SDK messages.
- Map WeCom single-chat and group chat IDs to stable Chat SDK thread IDs.
- Send non-streaming text and Markdown replies.
- Add message de-duplication using WeCom message IDs.
- Add automated tests and setup/usage documentation.
- Provide a safe `.env.example` template documenting required and optional environment variables without real credentials.

## Capabilities

### New Capabilities

- `wecom-websocket-connection`: Manage the intelligent robot WebSocket lifecycle, credentials, heartbeat, reconnection, and shutdown.
- `wecom-text-messaging`: Normalize single-chat and group text callbacks, map thread IDs, and send text/Markdown replies.
- `wecom-npm-package`: Build, typecheck, test, document, and publish the adapter as a standalone npm package.

### Modified Capabilities

## Impact

- Adds a new TypeScript npm package under this repository.
- Depends on the Chat SDK `chat` peer dependency and shared adapter utilities where applicable.
- Requires a WebSocket client dependency compatible with the package runtime.
- Requires a persistent process for production because each WeCom robot allows only one active connection.
- Introduces the environment variables `WECOM_BOT_ID` and `WECOM_BOT_SECRET`.
- Includes a non-secret `.env.example` template for local setup and deployment configuration.
