import type { MessagePart } from "~/lib/types/chat";
import { ChatSource } from "./chat/chat-source";
import { ChatText } from "./chat/chat-text";
import { ChatToolInvocation } from "./chat/chat-tool-invocation";

interface ChatMessageProps {
  parts: MessagePart[];
  role: string;
  userName: string;
}

export const ChatMessage = ({ parts, role, userName }: ChatMessageProps) => {
  const isAI = role === "assistant";

  if (!parts || parts.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div
        className={`rounded-lg p-4 ${
          isAI ? "bg-gray-800 text-gray-300" : "bg-gray-900 text-gray-300"
        }`}
      >
        <p className="mb-2 text-sm font-semibold text-gray-400">
          {isAI ? "AI" : userName}
        </p>

        <div className="space-y-4">
          {parts.map((part, index) => {
            switch (part.type) {
              case "text":
                return <ChatText key={index} part={part} />;
              case "tool-invocation":
                return <ChatToolInvocation key={index} part={part} />;
              case "source":
                // Log the source part to the console to inspect its structure
                if (process.env.NODE_ENV === "development") {
                  console.log("Source message part:", part);
                }
                return <ChatSource key={index} part={part} />;
              case "step-start":
                // Skip rendering step-start markers as they're just for internal use
                return null;
              default:
                // For unhandled part types, show a debug view in development
                if (process.env.NODE_ENV === "development") {
                  return (
                    <div
                      key={index}
                      className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 text-sm text-yellow-300"
                    >
                      <p className="font-mono text-xs text-yellow-400">
                        Unhandled message part type: {part.type}
                      </p>
                      <pre className="mt-2 overflow-x-auto rounded bg-black/20 p-2 text-xs">
                        {JSON.stringify(part, null, 2)}
                      </pre>
                    </div>
                  );
                }
                return null;
            }
          })}
        </div>
      </div>
    </div>
  );
};
