import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isNewChatCreated(
  data: unknown,
): data is {
  type: "NEW_CHAT_CREATED";
  chatId: string;
} {
  if (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === "NEW_CHAT_CREATED" &&
    "chatId" in data &&
    typeof data.chatId === "string"
  ) {
    return true;
  }
  return false;
}
