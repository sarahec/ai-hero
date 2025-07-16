import type { MessagePart } from "~/lib/types/chat";
import { ChatSource } from "./chat/chat-source";
import { ChatText } from "./chat/chat-text";
import { BookText } from "lucide-react";
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

  const sourceParts = parts.filter((part) => part.type === "source");
  const otherParts = parts.filter((part) => part.type !== "source");

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
          {otherParts.map((part, index) => {
            switch (part.type) {
              case "text":
                return <ChatText key={index} part={part} />;
              case "tool-invocation":
                return <ChatToolInvocation key={index} part={part} />;
              case "step-start":
                return null;
              default:
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

          {sourceParts.length > 0 && (
            <details className="rounded-lg border bg-gray-900/30 text-sm">
              <summary className="cursor-pointer list-none p-4 focus-visible:outline-none">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900/50">
                    <BookText className="h-4 w-4" />
                  </div>
                  <p className="font-semibold">
                    Sources ({sourceParts.length} items)
                  </p>
                </div>
              </summary>
              <div className="m-4 mt-0 space-y-4">
                {sourceParts.map((part, index) => (
                  <ChatSource key={index} part={part} />
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};
