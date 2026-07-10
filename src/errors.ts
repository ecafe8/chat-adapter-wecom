import { AuthenticationError, NetworkError } from "@chat-adapter/shared";

export const authenticationError = (message: string) => new AuthenticationError("wecom", message);
export const networkError = (message: string) => new NetworkError("wecom", message);
