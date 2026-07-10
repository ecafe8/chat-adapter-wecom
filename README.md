# chat-adapter-wecom

WeCom intelligent robot WebSocket adapter for [Chat SDK](https://chat-sdk.dev).

## Install

```bash
pnpm add chat-adapter-wecom chat @chat-adapter/state-memory
```

## Quick Start

Set the credentials outside version control. See `.env.example`:

```bash
WECOM_BOT_ID=your-bot-id
WECOM_BOT_SECRET=your-long-connection-secret
```

```ts
import { Chat } from "chat";
import { createMemoryState } from "@chat-adapter/state-memory";
import { createWeComAdapter } from "chat-adapter-wecom";

const bot = new Chat({
  userName: "wecom-bot",
  state: createMemoryState(),
  adapters: { wecom: createWeComAdapter() },
});

bot.onNewMention(async (thread, message) => {
  await thread.post(`收到：${message.text}`);
});

await bot.initialize();
```

Explicit configuration takes precedence over environment variables:

```ts
createWeComAdapter({
  botId: "your-bot-id",
  secret: "your-long-connection-secret",
});
```

The long-connection Secret is different from the Token and EncodingAESKey used by WeCom HTTP callback mode. Never commit either credential.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `WECOM_BOT_ID` | Yes | Intelligent robot BotID |
| `WECOM_BOT_SECRET` | Yes | Intelligent robot long-connection Secret |
| `WECOM_WS_URL` | No | WebSocket endpoint, defaults to `wss://openws.work.weixin.qq.com` |
| `WECOM_BOT_USERNAME` | No | Chat SDK bot username |
| `WECOM_HEARTBEAT_INTERVAL_MS` | No | Heartbeat interval, defaults to 30000 |
| `WECOM_RECONNECT_DELAY_MS` | No | Initial reconnect delay, defaults to 1000 |
| `WECOM_MAX_RECONNECT_DELAY_MS` | No | Maximum reconnect delay, defaults to 30000 |

## Supported Features

| Feature | Status |
| --- | --- |
| Single-chat text | Supported |
| Group `@robot` text | Supported |
| Text and basic Markdown replies | Supported |
| Persistent callback de-duplication | Supported through `StateAdapter` |
| Heartbeat and reconnect | Supported |
| Native streaming | Planned in `wecom-streaming-responses` |
| Template cards and buttons | Planned |
| Message history | Not provided by the intelligent robot API |
| Reactions, edit, delete | Not supported in this version |

WeCom only sends group callbacks when a user mentions the robot. Subscribing to a Chat SDK thread does not make all group messages available.

## Deployment

The adapter starts a background WebSocket loop in `Chat.initialize()` and stops it in `Chat.shutdown()`. Use one active process per BotID because WeCom allows only one active long connection for a robot. For high availability, use primary/standby rather than active/active replicas.

The adapter uses `StateAdapter` keys for message IDs and callback request context. Use a durable state adapter in multi-instance or restart-sensitive deployments.

## Development

```bash
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

Tests use fake WebSocket and state implementations and do not require real WeCom credentials.
