## 1. Package scaffold and configuration

- [x] 1.1 Create the root-level TypeScript ESM npm package metadata, exports, build configuration, typecheck configuration, test configuration, and license.
- [x] 1.2 Define adapter configuration and environment fallback for `botId`, `secret`, WebSocket URL, heartbeat, reconnect, and logger options.
- [x] 1.3 Add the `StateAdapter` runtime-state wrapper, validation errors, and safe logging rules that never print credentials.
- [x] 1.4 Add a non-secret `.env.example` with `WECOM_BOT_ID`, `WECOM_BOT_SECRET`, and documented optional transport settings.

## 2. WebSocket transport

- [x] 2.1 Implement WebSocket connection creation and `aibot_subscribe` request/response correlation.
- [x] 2.2 Implement incoming frame validation, request IDs, subscription state, and transport error handling.
- [x] 2.3 Implement heartbeat scheduling, unexpected-close detection, bounded reconnect scheduling, and duplicate-timer protection.
- [x] 2.4 Implement `initialize()` and `disconnect()` integration with Chat SDK lifecycle.

## 3. Text adapter behavior

- [x] 3.1 Implement single-chat and group thread ID encode/decode with validation.
- [x] 3.2 Implement text callback parsing into Chat SDK `Message` objects.
- [x] 3.3 Implement non-streaming text and Markdown posting through the WeCom response command.
- [x] 3.4 Implement StateAdapter-backed `msgid` de-duplication and unsupported callback handling.
- [x] 3.5 Wire supported callbacks to `ChatInstance.processMessage()`.

## 4. Tests

- [x] 4.1 Add factory/configuration tests for explicit credentials, environment fallback, precedence, and missing values.
- [x] 4.2 Add transport tests for subscription, malformed frames, heartbeat, reconnect, close, and shutdown.
- [x] 4.3 Add message parser and thread ID tests for single and group callbacks.
- [x] 4.4 Add posting tests for text, Markdown fallback, API errors, and response correlation.
- [x] 4.5 Add StateAdapter de-duplication and unsupported-event tests.
- [x] 4.6 Add Chat SDK integration tests using mocked WebSocket and Chat instances without real credentials.

## 5. Documentation and release readiness

- [x] 5.1 Write README setup instructions, environment variable reference, usage example, feature matrix, group mention semantics, and limitations.
- [x] 5.2 Ensure README and `.env.example` use the same variable names and explain that real credentials must be supplied outside version control.
- [x] 5.3 Document one-active-connection deployment requirements and graceful shutdown expectations.
- [x] 5.4 Document local test strategy and all quality commands.
- [x] 5.5 Run build, typecheck, tests, coverage, and package-content verification.
- [x] 5.6 Review package name, peer dependency range, version, changelog, and npm publish configuration.
