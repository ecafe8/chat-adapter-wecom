## MODIFIED Requirements

### Requirement: Callback dispatch
The adapter SHALL dispatch supported message callbacks to Chat SDK through the initialized `ChatInstance` and SHALL preserve the callback request context so a later streaming response can use the original WeCom request ID.

#### Scenario: Text callback arrives
- **WHEN** an `aibot_msg_callback` contains a supported text message
- **THEN** the adapter passes a lazy parsed message factory to Chat SDK processing and associates the callback request ID with the processing context

#### Scenario: Unsupported callback arrives
- **WHEN** a callback has an unsupported message or event type
- **THEN** the adapter acknowledges or ignores it according to transport rules and keeps the connection usable

#### Scenario: Stream response is posted during callback handling
- **WHEN** Chat SDK produces a stream while handling a callback
- **THEN** the adapter can resolve the callback request ID and send correlated WeCom stream frames
