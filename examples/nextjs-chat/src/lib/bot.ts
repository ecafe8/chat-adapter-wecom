import "server-only";

import { createMemoryState } from "@chat-adapter/state-memory";
import { Chat } from "chat";
import { createWeComAdapter } from "chat-adapter-wecom";

const globalForBot = globalThis as typeof globalThis & {
  wecomExampleBot?: Chat;
  wecomExampleInitialization?: Promise<Chat>;
};

export function getBot(): Chat {
  if (!globalForBot.wecomExampleBot) {
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
      await thread.post(`received: ${message.text}, reply: ${message.text}`);
    });
    bot.onSubscribedMessage(async (thread, message) => {
      console.log(`Received subscribed message in thread ${thread.id}: ${message.text}`);
      if (message.isMention) {
        await thread.post(`received: ${message.text}, reply: ${message.text}`);
      }
    });
    globalForBot.wecomExampleBot = bot;
  }
  return globalForBot.wecomExampleBot;
}

export async function ensureBotInitialized(): Promise<Chat> {
  if (!globalForBot.wecomExampleInitialization) {
    const bot = getBot();
    globalForBot.wecomExampleInitialization = bot.initialize().then(() => bot);
  }
  return globalForBot.wecomExampleInitialization;
}

export async function shutdownBot(): Promise<void> {
  if (globalForBot.wecomExampleBot) {
    await globalForBot.wecomExampleBot.shutdown();
    globalForBot.wecomExampleInitialization = undefined;
  }
}
