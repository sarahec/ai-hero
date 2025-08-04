import {
  streamText,
  type Message,
  type TelemetrySettings,
} from "ai";
import { model } from "~/lib/ai";
import { scrapePages, scrapePagesSchema } from "~/tools/scrape-pages";

/**
 * Stream responses from Deep Search
 * This function extracts the core logic from the chat API route
 * to make it testable in isolation
 */
export const streamFromDeepSearch = (opts: {
  messages: Message[];
  onFinish: Parameters<
    typeof streamText
  >[0]["onFinish"];
  telemetry: TelemetrySettings;
}) =>
  streamText({
    model,
    messages: opts.messages,
    maxSteps: 10,
    tools: {
      scrapePages: {
        description: "Scrape and process web pages to extract their content",
        parameters: scrapePagesSchema,
        execute: async ({ urls }) => {
          return await scrapePages(urls);
        },
      },
    },
    onFinish: opts.onFinish,
    experimental_telemetry: opts.telemetry,
  });

/**
 * Ask Deep Search a question and return the full response
 * This function is designed for use in evaluations
 */
export async function askDeepSearch(messages: Message[]): Promise<string> {
  const result = streamFromDeepSearch({
    messages,
    onFinish: () => {}, // just a stub
    telemetry: {
      isEnabled: false,
    },
  });

  // Consume the stream - without this,
  // the stream will never finish
  await result.consumeStream();

  return await result.text;
}
