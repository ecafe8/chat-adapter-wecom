## 1. Package scaffold and configuration

- [ ] 1.1 Create the standalone TypeScript ESM npm package metadata, exports, build configuration, typecheck configuration, test configuration, and license.
- [ ] 1.2 Define adapter configuration and environment fallback for `botId`, `secret`, WebSocket URL, heartbeat, reconnect, and logger options.
- [ ] 1.3 Add validation errors and safe logging rules that never print credentials.
- [ ] 1.4 Add a non-secret `.env.example` with `WECOM_BOT_ID`, `WECOM_BOT_SECRET`, and documented optional transport settings.

## 2. WebSocket transport

- [ ] 2.1 Implement WebSocket connection creation and `aibot_subscribe` request/response correlation.
- [ ] 2.2 Implement incoming frame validation, request IDs, subscription state, and transport error handling.
- [ ] 2.3 Implement heartbeat scheduling, unexpected-close detection, bounded reconnect scheduling, and duplicate-timer protection.
- [ ] 2.4 Implement `initialize()` and `disconnect()` integration with Chat SDK lifecycle.

## 3. Text adapter behavior

- [ ] 3.1 Implement single-chat and group thread ID encode/decode with validation.
- [ ] 3.2 Implement text callback parsing into Chat SDK `Message` objects.
- [ ] 3.3 Implement non-streaming text and Markdown posting through the WeCom response command.
- [ ] 3.4 Implement in-process `msgid` de-duplication and unsupported callback handling.
- [ ] 3.5 Wire supported callbacks to `ChatInstance.processMessage()`.

## 4. Tests

- [ ] 4.1 Add factory/configuration tests for explicit credentials, environment fallback, precedence, and missing values.
- [ ] 4.2 Add transport tests for subscription, malformed frames, heartbeat, reconnect, close, and shutdown.
- [ ] 4.3 Add message parser and thread ID tests for single and group callbacks.
- [ ] 4.4 Add posting tests for text, Markdown fallback, API errors, and response correlation.
- [ ] 4.5 Add de-duplication and unsupported-event tests.
- [ ] 4.6 Add Chat SDK integration tests using mocked WebSocket and Chat instances without real credentials.

## 5. Documentation and release readiness

- [ ] 5.1 Write README setup instructions, environment variable reference, usage example, feature matrix, group mention semantics, and limitations.
- [ ] 5.2 Ensure README and `.env.example` use the same variable names and explain that real credentials must be supplied outside version control.
- [ ] 5.3 Document one-active-connection deployment requirements and graceful shutdown expectations.
- [ ] 5.4 Document local test strategy and all quality commands.
- [ ] 5.5 Run build, typecheck, tests, coverage, and package-content verification.
- [ ] 5.6 Review package name, peer dependency range, version, changelog, and npm publish configuration.
