## ADDED Requirements

### Requirement: Normalize text messages
The adapter SHALL normalize WeCom single-chat and group text callbacks into Chat SDK messages containing stable IDs, author information, text, raw payload, timestamp metadata, and the encoded thread ID.

#### Scenario: Single-chat text is parsed
- **WHEN** a callback has `chattype: single` and a text body
- **THEN** the resulting message uses the sender user ID and a `wecom:single:` thread ID

#### Scenario: Group text is parsed
- **WHEN** a callback has `chattype: group`, a chat ID, and text content
- **THEN** the resulting message uses a `wecom:group:` thread ID and preserves the raw callback

### Requirement: Stable thread IDs
The adapter SHALL round-trip valid single-chat and group thread IDs and SHALL reject IDs with an invalid adapter prefix, type, or missing identifier.

#### Scenario: Group thread ID round-trips
- **WHEN** a group chat ID is encoded and then decoded
- **THEN** the original chat ID and group type are returned

#### Scenario: Invalid thread ID is rejected
- **WHEN** a caller decodes a malformed or foreign adapter ID
- **THEN** the adapter throws a validation error

### Requirement: Text and Markdown posting
The adapter SHALL send normalized text replies through the WeCom long-connection response command and SHALL render supported Chat SDK formatted content as WeCom-compatible Markdown or plain text.

#### Scenario: Plain text is posted
- **WHEN** a thread posts plain text
- **THEN** the adapter sends a valid WeCom text response for that conversation

#### Scenario: Formatted content is posted
- **WHEN** a thread posts supported formatted content
- **THEN** the adapter sends valid WeCom Markdown without unsupported syntax that would invalidate the request

### Requirement: Duplicate callback protection
The adapter SHALL avoid dispatching the same WeCom message ID more than once during a process lifetime.

#### Scenario: Duplicate message callback
- **WHEN** the same `msgid` is received twice
- **THEN** Chat SDK processing occurs only once

### Requirement: Group mention semantics
The adapter documentation SHALL state that WeCom intelligent robots receive group callbacks only when users mention the robot and that subscribing to a thread does not turn on all group traffic.

#### Scenario: Group follow-up without mention
- **WHEN** a group user sends a message without mentioning the robot
- **THEN** the adapter does not claim that Chat SDK will receive that message
