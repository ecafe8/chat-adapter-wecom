## ADDED Requirements

### Requirement: Credential configuration
The adapter SHALL accept `botId` and long-connection `secret` through constructor configuration and SHALL use `WECOM_BOT_ID` and `WECOM_BOT_SECRET` as fallbacks. Explicit constructor values SHALL take precedence over environment values.

#### Scenario: Credentials supplied explicitly
- **WHEN** the factory receives both `botId` and `secret`
- **THEN** it creates an adapter without reading either environment variable

#### Scenario: Credentials supplied by environment
- **WHEN** constructor values are absent and both environment variables are set
- **THEN** the factory creates an adapter using those environment values

#### Scenario: Credentials are missing
- **WHEN** either the bot ID or secret is unavailable
- **THEN** the factory fails with a validation error naming the missing configuration

### Requirement: WebSocket subscription
The adapter SHALL connect to the WeCom long-connection endpoint and SHALL send an `aibot_subscribe` request containing a unique request ID, the configured bot ID, and secret before processing callbacks.

#### Scenario: Subscription succeeds
- **WHEN** the socket opens and WeCom returns `errcode: 0`
- **THEN** the adapter marks the connection ready and accepts callbacks

#### Scenario: Subscription fails
- **WHEN** WeCom returns a non-zero subscription error
- **THEN** the adapter reports the failure and does not dispatch messages as connected

### Requirement: Heartbeat and reconnection
The adapter SHALL send periodic `ping` requests while connected and SHALL retry the connection after an unexpected close or connection error with bounded retry scheduling.

#### Scenario: Heartbeat is active
- **WHEN** the subscription is ready
- **THEN** the adapter sends heartbeats at the configured interval

#### Scenario: Connection is lost
- **WHEN** the socket closes unexpectedly
- **THEN** the adapter schedules a reconnect and does not create duplicate heartbeat timers

### Requirement: Graceful shutdown
The adapter SHALL stop heartbeat and reconnect timers and close the WebSocket when `disconnect()` is called.

#### Scenario: Shutdown during an active connection
- **WHEN** `disconnect()` is called after subscription
- **THEN** no further heartbeat or reconnect is scheduled and the socket is closed

### Requirement: Callback dispatch
The adapter SHALL dispatch supported message callbacks to Chat SDK through the initialized `ChatInstance` and SHALL ignore unsupported event types without crashing the connection.

#### Scenario: Text callback arrives
- **WHEN** an `aibot_msg_callback` contains a supported text message
- **THEN** the adapter passes a lazy parsed message factory to Chat SDK processing

#### Scenario: Unsupported callback arrives
- **WHEN** a callback has an unsupported message or event type
- **THEN** the adapter acknowledges or ignores it according to transport rules and keeps the connection usable
