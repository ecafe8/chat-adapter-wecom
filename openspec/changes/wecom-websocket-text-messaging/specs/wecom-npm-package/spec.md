## ADDED Requirements

### Requirement: Standalone package distribution
The adapter SHALL build as a root-level ESM npm package with JavaScript output, TypeScript declarations, source maps, a public entry point, and only the intended distribution files.

#### Scenario: Package builds
- **WHEN** the package build command runs
- **THEN** it produces importable ESM output and declarations without source TypeScript files, tests, or dependency directories in the package payload

### Requirement: Consumer documentation
The package SHALL document installation, Chat SDK registration, explicit configuration, environment variables, resident-process requirements, group mention behavior, supported features, and current limitations. The repository SHALL include a non-secret `.env.example` template with required and supported optional variables.

#### Scenario: New consumer follows setup
- **WHEN** a consumer follows the README using `WECOM_BOT_ID` and `WECOM_BOT_SECRET`
- **THEN** the consumer can start one configured adapter process without undocumented setup steps

#### Scenario: Consumer copies the environment template
- **WHEN** a consumer copies `.env.example` to a local environment file
- **THEN** the template identifies the required BotID and Secret variables and contains no real credentials

### Requirement: Quality checks
The package SHALL provide repeatable typecheck, unit test, integration test, and coverage commands.

#### Scenario: Quality commands run
- **WHEN** a maintainer runs the documented quality commands
- **THEN** typecheck and tests complete deterministically without requiring real WeCom credentials
