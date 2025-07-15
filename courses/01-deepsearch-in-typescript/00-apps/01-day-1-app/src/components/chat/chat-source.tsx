import { BookText } from "lucide-react";
import type { SourcePartProps } from "~/lib/types/chat";

export function ChatSource({ part }: SourcePartProps) {
  return (
    <div className="rounded-lg border bg-gray-900/30 p-4 text-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900/50">
          <BookText className="h-4 w-4" />
        </div>
        <p className="font-semibold">Source</p>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        <a
          href={part.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-md bg-gray-900/50 p-2 hover:bg-gray-900/80"
        >
          <p className="font-medium">{part.title}</p>
          <p className="text-xs text-gray-400">{part.url}</p>
        </a>
      </div>
    </div>
  );
}
