import type { Message } from "ai";
import { appendResponseMessages, createDataStreamResponse, streamText } from "ai";
import { and, count, eq, gte } from "drizzle-orm";
import { Langfuse } from "langfuse";
import { env } from "~/env";
import { model } from "~/lib/ai";
import { auth } from "~/server/auth";
import { scrapePages, scrapePagesSchema } from "~/tools/scrape-pages";
import { db } from "~/server/db";
import {
  requests,
  users,
  chats,
  messages as DBMessages,
} from "~/server/db/schema";

// Initialize Langfuse client
const langfuse = new Langfuse({
  environment: env.NODE_ENV,
});

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Create trace early to track the entire request
  const trace = langfuse.trace({
    name: "chat-request",
    userId: userId,
  });
  
  // Store user reference for later use
  let currentUser: { id: string; isAdmin: boolean } | null = null;

  try {
    // Track user lookup
    const userLookupSpan = trace.span({
      name: "find-user",
      input: { userId },
    });
    
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    if (userRecord) {
      currentUser = {
        id: userRecord.id,
        isAdmin: userRecord.isAdmin,
      };
    }
    
    userLookupSpan.end({
      output: { found: !!currentUser },
    });

    if (!currentUser) {
      trace.update({
        metadata: { error: "User not found" },
      });
      await langfuse.shutdownAsync();
      return new Response("Unauthorized", { status: 401 });
    }

    // Check rate limit for non-admin users
    if (!currentUser.isAdmin) {
      const rateLimitSpan = trace.span({
        name: "check-rate-limit",
        input: { userId: currentUser.id },
      });
      
      try {
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const result = await db
          .select({ value: count() })
          .from(requests)
          .where(
            and(eq(requests.userId, currentUser.id), gte(requests.createdAt, oneDayAgo)),
          );

        const value = result[0]?.value ?? 0;
        rateLimitSpan.end({
          output: { requestCount: value, limit: 10 },
        });

        if (value > 10) {
          trace.update({
            metadata: { error: "Rate limit exceeded" },
          });
          await langfuse.shutdownAsync();
          return new Response("Too many requests", { status: 429 });
        }
      } catch (error) {
        rateLimitSpan.end({
          output: { error: error instanceof Error ? error.message : "Unknown error" },
          metadata: { error: true },
        });
        throw error;
      }
    }

    const requestData = await request.json();
    const { messages, chatId }: { messages: Array<Message>; chatId?: string } = requestData;
    
    if (!messages || !Array.isArray(messages)) {
      trace.update({
        metadata: { error: "Invalid messages format" },
      });
      await langfuse.shutdownAsync();
      return new Response("Invalid messages format", { status: 400 });
    }
    
    trace.update({
      input: { 
        chatId, 
        messageCount: messages.length,
        hasChatId: !!chatId,
      },
    });

    // Track request insertion
    const requestInsertSpan = trace.span({
      name: "create-request-log",
      input: { userId: currentUser.id },
    });
    
    try {
      await db.insert(requests).values({
        userId: currentUser.id,
        path: request.url,
        method: request.method,
      });
      requestInsertSpan.end({
        output: { success: true },
      });
    } catch (error) {
      requestInsertSpan.end({
        output: { error: error instanceof Error ? error.message : "Unknown error" },
        metadata: { error: true },
      });
      throw error;
    }

    let finalChatId: string;
    
    // Update trace with chat-specific information
    trace.update({
      sessionId: chatId || `temp-${Date.now()}`,
      name: "chat",
      userId: currentUser.id,
    });

    return createDataStreamResponse({
      async execute(dataStream) {
        if (chatId) {
          finalChatId = chatId;
        } else {
          const createChatSpan = trace.span({
            name: "create-chat",
            input: { 
              userId: currentUser?.id,
              titlePreview: messages[0]?.content?.substring(0, 50) || "No title" 
            },
          });
          
          try {
            const [newChat] = await db
              .insert(chats)
              .values({
                userId: currentUser?.id,
                title: messages[0]?.content?.substring(0, 255) || "New Chat",
              })
              .returning();

            if (!newChat) {
              throw new Error("Could not create new chat");
            }
            
            createChatSpan.end({
              output: { chatId: newChat.id },
            });

            dataStream.writeData({
              type: "NEW_CHAT_CREATED",
              chatId: newChat.id,
            });

            // Update the trace with the final chat ID
            trace.update({
              sessionId: newChat.id,
            });

            const insertMessageSpan = trace.span({
              name: "insert-initial-message",
              input: { 
                chatId: newChat.id,
                messageId: messages[0]?.id,
                role: messages[0]?.role,
              },
            });
            
            try {
              await db.insert(DBMessages).values({
                chatId: newChat.id,
                id: messages[0]?.id || crypto.randomUUID(),
                role: messages[0]?.role || "user",
                parts: messages[0]?.parts || [],
                order: 0,
              });
              insertMessageSpan.end();
            } catch (error) {
              insertMessageSpan.end({
                output: { error: error instanceof Error ? error.message : "Failed to insert initial message" },
                metadata: { error: true },
              });
              throw error;
            }

            finalChatId = newChat.id;
          } catch (error) {
            createChatSpan.end({
              output: { error: error instanceof Error ? error.message : "Failed to create chat" },
              metadata: { error: true },
            });
            throw error;
          }
        }

        const streamTextSpan = trace.span({
          name: "stream-text",
          input: { 
            chatId: finalChatId,
            messageCount: messages.length,
          },
        });

        const result = await streamText({
          model: model,
          messages: messages,
          tools: {
            scrapePages: {
              description: "Scrape and process web pages to extract their content",
              parameters: scrapePagesSchema,
              execute: async ({ urls }) => {
                const scrapeSpan = trace.span({
                  name: "scrape-pages",
                  input: { urls },
                });
                
                try {
                  const results = await scrapePages({ urls });
                  scrapeSpan.end({
                    output: { success: true, count: results.length },
                  });
                  return results;
                } catch (error) {
                  scrapeSpan.end({
                    output: { error: error instanceof Error ? error.message : "Scraping failed" },
                    metadata: { error: true },
                  });
                  throw error;
                }
              },
            },
          },
          onFinish: async ({ response }) => {
            const updateChatSpan = trace.span({
              name: "update-chat-messages",
              input: { 
                chatId: finalChatId,
                messageCount: messages.length + 1, // +1 for the assistant's response
              },
            });

            try {
              // Start a transaction for updating chat messages
              await db.transaction(async (tx) => {
                const deleteSpan = trace.span({
                  name: "delete-old-messages",
                  input: { chatId: finalChatId },
                });
                
                try {
                  // Delete existing messages for this chat
                  await tx.delete(DBMessages).where(eq(DBMessages.chatId, finalChatId));
                  deleteSpan.end({ output: { success: true } });
                } catch (error) {
                  deleteSpan.end({
                    output: { error: error instanceof Error ? error.message : "Failed to delete messages" },
                    metadata: { error: true },
                  });
                  throw error;
                }

                const insertSpan = trace.span({
                  name: "insert-updated-messages",
                  input: { 
                    chatId: finalChatId,
                    messageCount: messages.length + 1, // +1 for the assistant's response
                  },
                });

                try {
                  // Insert all messages including the assistant's response
                  const allMessages = [
                    ...messages,
                    {
                      id: crypto.randomUUID(),
                      role: "assistant" as const,
                      content: response,
                    },
                  ];

                  await tx.insert(DBMessages).values(
                    allMessages.map((msg, index) => ({
                      id: msg.id || crypto.randomUUID(),
                      chatId: finalChatId,
                      role: msg.role,
                      content: msg.content,
                      parts: msg.parts || [],
                      order: index,
                    }))
                  );

                  insertSpan.end({
                    output: { success: true, messageCount: allMessages.length },
                  });
                } catch (error) {
                  insertSpan.end({
                    output: { error: error instanceof Error ? error.message : "Failed to insert messages" },
                    metadata: { error: true },
                  });
                  throw error;
                }
              });

              updateChatSpan.end({
                output: { success: true },
              });
            } catch (error) {
              updateChatSpan.end({
                output: { error: error instanceof Error ? error.message : "Failed to update chat" },
                metadata: { error: true },
              });
              throw error;
            }
          },
          onError: (error) => {
            console.error(error);
            // Use void to explicitly ignore the promise since we can't make this async
            void (async () => {
              const errorTrace = langfuse.trace({
                name: "chat-error",
                userId: userId,
                metadata: { 
                  error: error instanceof Error ? error.message : "Unknown error",
                  stack: error instanceof Error ? error.stack : undefined,
                },
              });
              await langfuse.flushAsync();
              await langfuse.shutdownAsync();
            })();
            return "Oops, an error occurred!";
          },
          experimental_telemetry: {
            isEnabled: true,
            functionId: "chat-request",
            langfuseTraceId: trace.id,
          },
        });

        streamTextSpan.end();
        result.mergeIntoDataStream(dataStream, {
          sendSources: true,
        });
      },
    });
  } catch (error) {
    const errorTrace = langfuse.trace({
      name: "chat-error",
      userId: userId,
      metadata: { 
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    await langfuse.flushAsync();
    await langfuse.shutdownAsync();
    throw error;
  } finally {
    // Ensure we flush any pending events
    await langfuse.shutdownAsync();
  }
}
