import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Carries the WeCom callback `req_id` through the async call chain triggered
 * by `chat.processMessage()`. Using AsyncLocalStorage (instead of a shared
 * value keyed only by `threadId`) keeps concurrent callbacks for the same
 * thread from clobbering each other's request context: each call to
 * `runWithRequestId` gets its own isolated frame that follows the actual
 * execution — including through `await`, timers, and other async
 * continuations — rather than a single mutable slot per thread.
 */
const requestContext = new AsyncLocalStorage<string>();

export function runWithRequestId<T>(requestId: string, fn: () => Promise<T>): Promise<T> {
  return requestContext.run(requestId, fn);
}

export function getCurrentRequestId(): string | undefined {
  return requestContext.getStore();
}
