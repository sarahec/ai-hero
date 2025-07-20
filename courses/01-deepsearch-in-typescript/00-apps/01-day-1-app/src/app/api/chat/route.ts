import type { Message } from "ai";
import { appendResponseMessages, createDataStreamResponse, streamText } from "ai";
import { model } from "~/lib/ai";
import { auth } from "~/server/auth";
import {
  checkRateLimit,
  createChat,
  getUserById,
  logRequest,
  updateChat,
} from "~/server/db/chat";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await getUserById(session.user.id);

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!user.isAdmin) {
    const requestsCount = await checkRateLimit(user.id);
    if (requestsCount > 10) {
      return new Response("Too many requests", { status: 429 });
    }
  }

  const {
    messages,
    chatId,
  }: { messages: Array<Message>; chatId?: string } = await request.json();

  return createDataStreamResponse({
    execute: async (dataStream) => {
      await logRequest(user.id);

      const finalChatId = chatId ?? (await createChat(user.id, messages[0]!));

      const result = await streamText({
        model,
        messages,
        system: `
          You are a helpful assistant that can search the web. 
          When you use your search tool, you will be given a list of sources. 
          Please cite your sources whenever possible and use inline markdown links like [title](url).
        `,
        onFinish: async ({ response }) => {
          const updatedMessages = appendResponseMessages({
            messages,
            responseMessages: response.messages,
          });

          await updateChat(finalChatId, updatedMessages);
        },
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
