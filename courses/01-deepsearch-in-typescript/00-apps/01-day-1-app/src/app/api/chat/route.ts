import type { Message } from "ai";
import { createDataStreamResponse, streamText } from "ai";
import { z } from "zod";
import { model } from "~/lib/ai";

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
          When you use your search tool, you will be given a list of sources. 
          Please cite your sources whenever possible and use inline markdown links like [title](url).
        `,
      });

      result.mergeIntoDataStream(dataStream, {
        sendSources: true,
      });
    },
    onError: (e) => {
      console.error(e);
      return "Oops, an error occured!";
    },
  });
}
