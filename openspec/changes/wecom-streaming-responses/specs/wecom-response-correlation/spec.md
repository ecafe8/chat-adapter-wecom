## ADDED Requirements

### Requirement: Preserve callback request correlation
The adapter SHALL associate every streamed response with the originating WeCom callback `req_id` and SHALL use that same `req_id` for all response frames.

#### Scenario: Response follows a message callback
- **WHEN** Chat SDK handles a callback with `req_id: R1` and produces a stream
- **THEN** every stream response frame uses `headers.req_id: R1`

#### Scenario: Concurrent group callbacks
- **WHEN** two group callbacks have different request IDs and produce streams concurrently
- **THEN** each stream uses only its own request ID and content

### Requirement: Context cleanup
The adapter SHALL remove response correlation state after successful completion, failure, cancellation, deadline, or connection loss.

#### Scenario: Completed stream is cleaned up
- **WHEN** a stream sends its final frame
- **THEN** its request and stream context is no longer retained as active state

#### Scenario: Abandoned stream expires
- **WHEN** a stream receives no usable completion because of an error or timeout
- **THEN** bounded cleanup removes the context without affecting other active streams
