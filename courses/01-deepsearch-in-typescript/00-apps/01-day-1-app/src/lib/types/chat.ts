import type { Message } from "ai";

export type MessagePart = NonNullable<Message["parts"]>[number];

export interface ChatMessageProps {
  parts: MessagePart[];
  role: string;
  userName: string;
}

export interface ToolInvocationPartProps {
  part: Extract<MessagePart, { type: "tool-invocation" }>;
}

export interface TextPartProps {
  part: Extract<MessagePart, { type: "text" }>;
}

export interface SourcePartProps {
  part: Extract<MessagePart, { type: "source" }>;
}
