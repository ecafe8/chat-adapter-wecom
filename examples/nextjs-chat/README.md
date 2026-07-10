# Next.js WeCom Chat Example

Small App Router application for manually testing `chat-adapter-wecom` with a WeCom intelligent robot.

## Prerequisites

- Node.js 22+
- A WeCom intelligent robot configured for API mode and long connection
- BotID and long-connection Secret
- A test group containing the robot

## Setup

From this repository root:

```bash
npm install
cd examples/nextjs-chat
npm install
cp .env.example .env.local
```

Fill in `WECOM_BOT_ID` and `WECOM_BOT_SECRET` in `.env.local`, then run:

```bash
npm run dev
```

Open `http://localhost:3000`. The page initializes the Chat SDK bot on the server and displays the initialization result. `GET /api/status` provides a machine-readable status response.

## Test With WeCom

1. Start the Next.js process and keep it running.
2. Open the configured WeCom test group.
3. Mention the intelligent robot with a text message.
4. Verify that the Chat SDK handler sends a reply.

This adapter receives group callbacks only when the robot is mentioned. The example uses in-memory state for local testing and is not intended for production persistence.

The example keeps `chat-adapter-wecom` and its `ws` dependencies external in `next.config.ts`. This is required because `ws` loads optional Node.js acceleration modules at runtime and bundling them into a Next.js server bundle can cause `bufferUtil.mask is not a function`.

## Deployment Note

The WeCom intelligent robot permits one active WebSocket connection per BotID. This example is intended for a resident Node.js process, not a serverless deployment where instances can be frequently replaced or run concurrently. Use a durable `StateAdapter` and a single active process for production.

## Useful Commands

```bash
npm run typecheck
npm run build
npm run start
```
