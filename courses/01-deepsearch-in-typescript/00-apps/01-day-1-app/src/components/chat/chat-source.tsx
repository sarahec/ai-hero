import { BookText } from "lucide-react";
import type { SourcePartProps } from "~/lib/types/chat";

export function ChatSource({ part }: SourcePartProps) {
  return (
    <div className="rounded-lg border bg-black/20 p-4 text-sm">
      <pre className="overflow-x-auto text-xs">
        {JSON.stringify(part, null, 2)}
      </pre>
    </div>
  );
}

