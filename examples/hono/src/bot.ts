import { createMemoryState } from "@chat-adapter/state-memory";
import { Chat } from "chat";
import { createWeComAdapter } from "chat-adapter-wecom";

export function createBot(): Chat {
  const bot = new Chat({
    userName: process.env.WECOM_BOT_USERNAME ?? "wecom-bot",
    state: createMemoryState(),
    adapters: {
      wecom: createWeComAdapter(),
    },
  });

  bot.onDirectMessage(async (thread, message) => {
    console.log(`Received direct message in thread ${thread.id}: ${message.text}`);
    await thread.post(`received direct message: ${message.text}`);
  });

  bot.onNewMention(async (thread, message) => {
    console.log(`Received mention in thread ${thread.id}: ${message.text}`);
    await thread.post(`received - Mention: ${message.text}, reply: ${message.text}`);
  });

  bot.onSubscribedMessage(async (thread, message) => {
    console.log(`Received subscribed message in thread ${thread.id}: ${message.text}`);
    if (message.isMention) {
      await thread.post(`received - Message: ${message.text}, reply: ${message.text}`);
    }
  });

  return bot;
}
