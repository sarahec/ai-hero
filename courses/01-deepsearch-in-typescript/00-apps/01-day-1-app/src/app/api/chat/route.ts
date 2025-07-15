import type { Message } from "ai";
import { createDataStreamResponse, streamText } from "ai";
import { z } from "zod";
import { model } from "~/lib/ai";
import { searchSerper } from "~/serper";
import { auth } from "~/server/auth";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as {
    messages: Array<Message>;
  };

  return createDataStreamResponse({
    execute: async (dataStream) => {
      const { messages } = body;

      const result = await streamText({
        model,
        messages,
        system: `
          You are a helpful assistant that can search the web. 
          1. Please use the search web tool to answer the user's questions. 
          Cite your sources whenever possible
          and use inline markdown links like [title](url).
        `,
        tools: {
          searchWeb: {
            parameters: z.object({
              query: z.string().describe("The query to search the web for"),
            }),
            execute: async ({ query }, { abortSignal }) => {
              const results = await searchSerper(
                { q: query, num: 10 },
                abortSignal,
              );

              return results.organic.map((result) => ({
                title: result.title,
                link: result.link,
                snippet: result.snippet,
              }));
            },
          },
        },
        maxSteps: 10,
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (e) => {
      console.error(e);
      return "Oops, an error occured!";
    },
  });
}
