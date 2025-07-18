import type { Message } from "ai";
import { db } from ".";
import { chats, messages as messagesTable } from "./schema";
import { and, eq } from "drizzle-orm";

export const upsertChat = async (opts: {
  userId: string;
  chatId: string;
  title: string;
  messages: Message[];
}) => {
  const { userId, chatId, title, messages } = opts;

  return db.transaction(async (tx) => {
    // Upsert the chat
    await tx
      .insert(chats)
      .values({ id: chatId, userId, title })
      .onConflictDoUpdate({ target: chats.id, set: { title, updatedAt: new Date() } });

    // Delete existing messages for the chat
    await tx.delete(messagesTable).where(eq(messagesTable.chatId, chatId));

    // Insert new messages
    if (messages.length > 0) {
      await tx.insert(messagesTable).values(
        messages.map((message, i) => ({
          id: message.id,
          chatId,
          role: message.role,
          parts: message.content,
          order: i,
        }))
      );
    }

    const [chat] = await tx.select().from(chats).where(eq(chats.id, chatId));

    return chat;
  });
};

export const getChat = async (chatId: string, userId: string) => {
  const chat = await db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    with: {
      messages: {
        orderBy: (messages, { asc }) => [asc(messages.order)],
      },
    },
  });

  return chat;
};

export const getChats = async (userId: string) => {
  const userChats = await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: (chats, { desc }) => [desc(chats.createdAt)],
  });

  return userChats;
};
