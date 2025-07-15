import { cn } from "~/lib/utils";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import type { ToolInvocationPartProps } from "~/lib/types/chat";

export const ChatToolInvocation = ({ part }: ToolInvocationPartProps) => {
  const { toolInvocation } = part;
  const { toolName, state, args, toolCallId } = toolInvocation;
  const isComplete = state === "result";
  const isProcessing = state === "partial-call" || state === "call";
  const hasResult = isComplete && toolInvocation.result;

  return (
    <div 
      className={cn(
        "group relative mb-4 rounded-lg border p-4 transition-all hover:shadow-md",
        isComplete 
          ? "border-green-500/30 bg-green-500/5 hover:bg-green-500/10"
          : "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10",
      )}
    >
      <TooltipProvider>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium",
                isComplete 
                  ? "bg-green-500/20 text-green-400" 
                  : "bg-blue-500/20 text-blue-400"
              )}
            >
              {toolName}
            </div>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  className="text-gray-400 hover:text-gray-300"
                  aria-label="Learn more about this tool call"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  This is a tool call. Hover over different parts to explore the data being passed to and from the tool.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <div className="text-xs text-gray-400">
            {isProcessing ? "Processing..." : "Complete"}
          </div>
        </div>
      </TooltipProvider>

      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs font-medium text-gray-400">
            Arguments
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 opacity-50 hover:opacity-100" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">These are the parameters sent to the tool.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="overflow-x-auto rounded bg-gray-800/50 p-2 text-xs">
            <pre>{JSON.stringify(args, null, 2)}</pre>
          </div>
        </div>

        {hasResult && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs font-medium text-gray-400">
              Result
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 opacity-50 hover:opacity-100" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">This is the data returned by the tool.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="overflow-x-auto rounded bg-gray-800/50 p-2 text-xs">
              <pre>{JSON.stringify(toolInvocation.result, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 text-right">
        <span className="text-[10px] text-gray-500">
          ID: {toolCallId.substring(0, 8)}...
        </span>
      </div>
    </div>
  );
};
