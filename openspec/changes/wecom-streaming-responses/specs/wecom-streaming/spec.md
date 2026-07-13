## ADDED Requirements

### Requirement: Native streaming replies
The adapter SHALL implement the Chat SDK `Adapter.stream()` method to consume an `AsyncIterable<string | StreamChunk>` and translate it into WeCom `aibot_respond_msg` stream frames, SHALL send the accumulated content for each update, and SHALL return a `RawMessage` rather than `null` so Chat SDK's post+edit fallback never runs for WeCom.

#### Scenario: Stream sends incremental content
- **WHEN** a thread posts an async iterable that yields multiple text chunks
- **THEN** the adapter sends an initial non-final stream frame followed by updates containing accumulated content

#### Scenario: Stream completes
- **WHEN** the async iterable finishes normally
- **THEN** the adapter sends a final frame with `finish: true` using the same stream ID

### Requirement: Structured chunk handling
The adapter SHALL extract text from `MarkdownTextChunk` entries and SHALL ignore `TaskUpdateChunk` and `PlanUpdateChunk` entries, because WeCom streaming carries text only. Plain string chunks SHALL be appended directly to the accumulated content.

#### Scenario: Markdown text chunk
- **WHEN** the iterable yields a `MarkdownTextChunk` with `type: "markdown_text"`
- **THEN** the adapter appends `chunk.text` to the accumulated content for the next stream frame

#### Scenario: Non-text structured chunk
- **WHEN** the iterable yields a `task_update` or `plan_update` chunk
- **THEN** the adapter ignores it and continues accumulating text from subsequent chunks without sending an empty update

### Requirement: Stream identity
The adapter SHALL generate one unique stream ID per response stream and SHALL reuse it for every frame belonging to that response.

#### Scenario: One response has multiple frames
- **WHEN** one async iterable yields multiple chunks
- **THEN** all corresponding frames use the same stream ID

#### Scenario: Concurrent responses
- **WHEN** two callbacks for the same group stream concurrently
- **THEN** each response uses a different stream ID and its content remains isolated

### Requirement: Stream deadline
The adapter SHALL enforce a response deadline shorter than or equal to the WeCom ten-minute streaming limit and SHALL finalize or cancel streams that exceed it.

#### Scenario: Stream exceeds deadline
- **WHEN** an async iterable remains active past the configured deadline
- **THEN** the adapter stops forwarding new chunks and sends a best-effort final frame

### Requirement: Stream errors and cancellation
The adapter SHALL stop forwarding after cancellation or transport loss and SHALL surface iterator failures through the adapter logger without leaving active stream state indefinitely.

#### Scenario: Iterator fails
- **WHEN** the async iterable rejects
- **THEN** the adapter cleans up stream state, logs the error, and attempts a final frame when the connection is usable

#### Scenario: Connection closes
- **WHEN** the WebSocket closes while a stream is active
- **THEN** the adapter stops sending frames for that stream and releases its context
