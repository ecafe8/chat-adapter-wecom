import { createMemoryState } from "@chat-adapter/state-memory";
import { Chat } from "chat";
import { createWeComAdapter } from "chat-adapter-wecom";

/**
 * 模拟第三方调用（天气 API、搜索等）的占位实现。
 * 实际使用时请替换为真实的 fetch() 调用，演示“稍等” -> 调用工具 -> 最终回复的模式。
 */
async function fetchWeather(city: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return `${city} today: 29°C, mostly cloudy, 60% chance of rain`;
}

function isWeatherQuestion(text: string): boolean {
  return /天气|weather/i.test(text);
}

function isStreamRequest(text: string): boolean {
  return /流式|stream|讲故事|讲个故事/i.test(text);
}

/**
 * 流式回复演示：逐段产出文本并带有间隔，
 * 用于在企微中观察 aibot_respond_msg 流式帧的增量渲染。
 *
 * 对接真正的 AI 流式接口时，把这里的生成器换成
 *   yield* streamText({ model, prompt }).textStream
 * （需要安装 `ai` 包及对应 model provider）即可，
 * 适配器会通过 adapter.stream() 把 textStream 翻译成企微流式帧。
 */
async function* streamReply(prompt: string): AsyncIterable<string> {
  const chunks = [
    `收到「${prompt}」，下面用流式回复演示：\n\n`,
    "每个片段会作为一次增量更新发送给企微，",
    "聊天窗口里会看到内容逐步增长，",
    "直到最后一帧带 finish=true 收尾。\n\n",
    "并发场景下，每个回调的 req_id 与 stream.id 互不串扰；",
    "超过 9 分钟（可在 WECOM_STREAM_DEADLINE_MS 调整）会被强制收尾。",
  ];
  for (const chunk of chunks) {
    yield chunk;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

export function createBot(): Chat {
  const bot = new Chat({
    userName: process.env.WECOM_BOT_USERNAME ?? "wecom-bot",
    state: createMemoryState(),
    adapters: {
      wecom: createWeComAdapter(),
    },
  });

  // 单聊消息（企微用户与机器人的单聊）始终会进入这里，
  // 线程中的每一条消息都会触发，不需要调用 subscribe()。
  bot.onDirectMessage(async (thread, message) => {
    console.log(`Received direct message in thread ${thread.id}: ${message.text}`);

    if (isStreamRequest(message.text)) {
      // 流式回复：thread.post(asyncIterable) 会派发到 adapter.stream()，
      // 由适配器翻译成企微 aibot_respond_msg 流式帧。
      await thread.post(streamReply(message.text));
      return;
    }

    if (isWeatherQuestion(message.text)) {
      // 同一次 handler 调用内的多步骤回复：
      // 1. 立即回复，让用户知道机器人正在处理。
      await thread.post("稍等，正在查询天气…");

      // 2. 调用第三方工具。
      const weather = await fetchWeather("Guangzhou");

      // 3. 把最终结果作为同一线程里的后续消息发出。
      await thread.post(`查询完成：${weather}`);
      return;
    }

    await thread.post(`received direct message: ${message.text}`);
  });

  // 群聊中 @机器人 的消息，只有在该线程尚未被订阅时才会进入这里。
  // 调用 thread.subscribe() 后，后续消息（包括之后的再次 @）
  // 会改为触发 onSubscribedMessage。
  bot.onNewMention(async (thread, message) => {
    console.log(`Received mention in thread ${thread.id}: ${message.text}`);
    await thread.subscribe();

    if (isStreamRequest(message.text)) {
      await thread.post(streamReply(message.text));
      return;
    }

    if (isWeatherQuestion(message.text)) {
      await thread.post("稍等，正在查询天气…");
      const weather = await fetchWeather("Guangzhou");
      await thread.post(`查询完成：${weather}`);
      return;
    }

    await thread.post(`received - Mention: ${message.text}, reply: ${message.text}`);
  });

  // 已订阅（群聊）线程中的后续消息——包括第二次、第三次……的 @机器人，
  // 都会进入这里，而不是 onNewMention。
  //
  // 注意：对企微来说，这里的 message.isMention 永远是 true，
  // 因为企微只会把已经 @机器人 的群消息推送过来（不存在非 @ 的群消息回调）。
  // 所以下面这个 isMention 判断，对当前适配器而言是死代码；
  // 保留它只是为了表达意图，并且在其他平台（例如 Slack，
  // onSubscribedMessage 会对已订阅线程里的所有消息触发，无论是否被提及）
  // 上，这个判断才会真正起作用。
  bot.onSubscribedMessage(async (thread, message) => {
    console.log(`Received subscribed message in thread ${thread.id}: ${message.text}`);
    if (!message.isMention) return;

    if (isStreamRequest(message.text)) {
      await thread.post(streamReply(message.text));
      return;
    }

    if (isWeatherQuestion(message.text)) {
      await thread.post("稍等，正在查询天气…");
      const weather = await fetchWeather("Guangzhou");
      await thread.post(`查询完成：${weather}`);
      return;
    }

    await thread.post(`received - Mention: ${message.text}, reply: ${message.text}`);
  });

  return bot;
}
