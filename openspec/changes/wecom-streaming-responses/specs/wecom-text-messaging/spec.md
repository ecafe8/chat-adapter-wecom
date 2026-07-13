## MODIFIED Requirements

### Requirement: Text and Markdown posting
The adapter SHALL send normalized text replies through the WeCom long-connection response command, SHALL render supported Chat SDK formatted content as WeCom-compatible Markdown or plain text, and SHALL use native streaming when the postable contains an asynchronous text stream.

#### Scenario: Plain text is posted
- **WHEN** a thread posts plain text
- **THEN** the adapter sends a valid WeCom text response for that conversation

#### Scenario: Formatted content is posted
- **WHEN** a thread posts supported formatted content
- **THEN** the adapter sends valid WeCom Markdown without unsupported syntax that would invalidate the request

#### Scenario: Async text stream is posted
- **WHEN** a thread posts an asynchronous text stream associated with an incoming callback
- **THEN** Chat SDK dispatches to the adapter's `stream()` method, which sends native WeCom stream frames instead of requiring a message edit operation, while plain text/markdown posting still routes through `postMessage`
