import type { Message } from "ai";
import { appendResponseMessages, createDataStreamResponse, streamText } from "ai";
import { and, count, eq, gte } from "drizzle-orm";
import { model } from "~/lib/ai";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import {
  requests,
  users,
  chats,
  messages as DBMessages,
} from "~/server/db/schema";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!user.isAdmin) {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const result = await db
      .select({ value: count() })
      .from(requests)
      .where(
        and(eq(requests.userId, user.id), gte(requests.createdAt, oneDayAgo)),
      );

    const value = result[0]?.value ?? 0;

    if (value > 10) {
      return new Response("Too many requests", { status: 429 });
    }
  }

  const {
    messages,
    chatId,
  }: { messages: Array<Message>; chatId?: string } = await request.json();

  return createDataStreamResponse({
    execute: async (dataStream) => {
      await db.insert(requests).values({ userId: user.id });

      let finalChatId: string;

      if (chatId) {
        finalChatId = chatId;
      } else {
        const [newChat] = await db
          .insert(chats)
          .values({
            userId: user.id,
            title: messages[0]!.content.substring(0, 255),
          })
          .returning();

        if (!newChat) {
          throw new Error("Could not create new chat");
        }

        dataStream.writeData({
          type: "NEW_CHAT_CREATED",
          chatId: newChat.id,
        });

        await db.insert(DBMessages).values({
          chatId: newChat.id,
          id: messages[0]!.id,
          role: messages[0]!.role,
          parts: messages[0]!.parts,
          order: 0,
        });

        finalChatId = newChat.id;
      }

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

          await db.transaction(async (tx) => {
            await tx
              .delete(DBMessages)
              .where(eq(DBMessages.chatId, finalChatId));

            await tx.insert(DBMessages).values(
              updatedMessages.map((message, index) => ({
                id: message.id,
                chatId: finalChatId,
                role: message.role,
                parts: message.parts,
                order: index,
              })),
            );
          });
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
