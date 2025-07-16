import type { Message } from "ai";
import { createDataStreamResponse, streamText } from "ai";
import { and, count, eq, gte } from "drizzle-orm";
import { model } from "~/lib/ai";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { requests, users } from "~/server/db/schema";

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

  const body = (await request.json()) as {
    messages: Array<Message>;
  };

  return createDataStreamResponse({
    execute: async (dataStream) => {
      const { messages } = body;

      await db.insert(requests).values({ userId: user.id });

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
