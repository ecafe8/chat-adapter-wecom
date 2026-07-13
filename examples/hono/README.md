# Hono WeCom Chat Example

Minimal resident Node.js application using [Hono](https://hono.dev) and `chat-adapter-wecom`.

## Prerequisites

- Node.js 22+
- A WeCom intelligent robot configured for API mode and long connection
- BotID and long-connection Secret
- A test group containing the robot

## Setup

From this repository root:

```bash
npm install
cd examples/hono
npm install
cp .env.example .env
```

Fill in `WECOM_BOT_ID` and `WECOM_BOT_SECRET`, then run:

```bash
npm run dev
```

The example loads `.env` automatically through `dotenv`.

The HTTP server listens on `http://localhost:8787` by default.

## Test With WeCom

1. Keep the Hono process running.
2. Open a test group containing the intelligent robot.
3. Mention the robot in a text message.
4. Check the terminal for the received message log.
5. Confirm the robot replies in the group.

The example registers `onDirectMessage`, `onNewMention`, and `onSubscribedMessage`. Direct messages use `onDirectMessage`; group mentions in unsubscribed threads use `onNewMention`; follow-up messages in subscribed threads use `onSubscribedMessage`. Chat SDK otherwise falls back to routing unhandled direct messages through `onNewMention` for backward compatibility.

### Multi-step replies ("please wait" -> tool call -> final answer)

Send a message containing "天气" (weather) to see a two-step reply:

1. The bot immediately posts "稍等，正在查询天气…".
2. It awaits a simulated third-party API call (`fetchWeather` in `src/bot.ts` — replace with a real fetch).
3. It posts the final answer as a follow-up message in the same thread.

This works with a single handler invocation and plain sequential `await thread.post(...)` calls — no subscription is required for this pattern.

### Continuing a conversation across multiple messages

If you want the bot to keep responding to *new* messages in a group thread (e.g. the user asks a follow-up question later), call `thread.subscribe()` once — this example does it in `onNewMention` — so later messages in that thread route to `onSubscribedMessage` instead of falling through unmention patterns. Direct message (single-chat) threads do not need `subscribe()`; every message routes to `onDirectMessage` already.

Check HTTP health:

```bash
curl http://localhost:8787/health
```

## Production Notes

This is a resident Node.js process, not a serverless handler. WeCom permits only one active WebSocket connection per BotID. Use a durable `StateAdapter` instead of `createMemoryState()` for production and run one active process per robot.

The example keeps `chat-adapter-wecom` and `ws` external in the Node.js build. This preserves their native Node.js runtime loading. Do not import the bot module into browser code.

## Commands

```bash
npm run typecheck
npm run build
npm start
```
