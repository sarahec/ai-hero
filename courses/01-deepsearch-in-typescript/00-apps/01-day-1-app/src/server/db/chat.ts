import type { Message } from "ai";
import { db } from ".";
import {
  chats,
  messages as messagesTable,
  users,
  requests,
} from "./schema";
import { and, count, eq, gte } from "drizzle-orm";

export const getUserById = async (userId: string) => {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
  });
};

export const logRequest = async (userId: string) => {
  return db.insert(requests).values({ userId });
};

export const checkRateLimit = async (userId: string) => {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const result = await db
    .select({ value: count() })
    .from(requests)
    .where(and(eq(requests.userId, userId), gte(requests.createdAt, oneDayAgo)));

  return result[0]?.value ?? 0;
};

export const createChat = async (userId: string, initialMessage: Message) => {
  const [newChat] = await db
    .insert(chats)
    .values({
      userId,
      title: initialMessage.content.substring(0, 255),
    })
    .returning();

  if (!newChat) {
    throw new Error("Could not create new chat");
  }

  await db.insert(messagesTable).values({
    chatId: newChat.id,
    id: initialMessage.id,
    role: initialMessage.role,
    parts: initialMessage.parts,
    order: 0,
  });

  return newChat.id;
};

export const updateChat = async (chatId: string, messages: Message[]) => {
  return db.transaction(async (tx) => {
    await tx
      .delete(messagesTable)
      .where(eq(messagesTable.chatId, chatId));

    await tx.insert(messagesTable).values(
      messages.map((message, index) => ({
        id: message.id,
        chatId: chatId,
        role: message.role,
        parts: message.parts,
        order: index,
      })),
    );
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
