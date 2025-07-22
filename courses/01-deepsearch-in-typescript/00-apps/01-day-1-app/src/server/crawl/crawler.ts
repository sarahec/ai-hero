import * as cheerio from "cheerio";
import { setTimeout } from "node:timers/promises";
import robotsParser from "robots-parser";
import TurndownService from "turndown";
import { cacheWithRedis } from "~/server/redis/redis";
import { env } from "~/env";
import { Langfuse } from "langfuse";

// Initialize Langfuse client if keys are available
const langfuse = env.LANGFUSE_SECRET_KEY && env.LANGFUSE_PUBLIC_KEY
  ? new Langfuse({
      secretKey: env.LANGFUSE_SECRET_KEY,
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      baseUrl: env.LANGFUSE_BASEURL,
    })
  : null;

export const DEFAULT_MAX_RETRIES = 3;
const MIN_DELAY_MS = 500; // 0.5 seconds
const MAX_DELAY_MS = 8000; // 8 seconds

export interface CrawlSuccessResponse {
  success: true;
  data: string;
}

export interface CrawlErrorResponse {
  success: false;
  error: string;
}

export type CrawlResponse =
  | CrawlSuccessResponse
  | CrawlErrorResponse;

export interface BulkCrawlSuccessResponse {
  success: true;
  results: {
    url: string;
    result: CrawlSuccessResponse;
  }[];
}

export interface BulkCrawlFailureResponse {
  success: false;
  results: {
    url: string;
    result: CrawlResponse;
  }[];
  error: string;
}

export type BulkCrawlResponse =
  | BulkCrawlSuccessResponse
  | BulkCrawlFailureResponse;

export interface CrawlOptions {
  maxRetries?: number;
}

export interface BulkCrawlOptions extends CrawlOptions {
  urls: string[];
  traceId?: string;
}

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
});

const extractArticleText = (html: string): string => {
  const $ = cheerio.load(html);
  $(
    "script, style, nav, header, footer, iframe, noscript",
  ).remove();

  const articleSelectors = [
    "article",
    '[role="main"]',
    ".post-content",
    ".article-content",
    "main",
    ".content",
  ];

  let content = "";

  for (const selector of articleSelectors) {
    const element = $(selector);
    if (element.length) {
      content = turndownService.turndown(
        element.html() || "",
      );
      break;
    }
  }

  if (!content) {
    content = turndownService.turndown(
      $("body").html() || "",
    );
  }

  return content.trim();
};

const checkRobotsTxt = async (
  url: string,
): Promise<boolean> => {
  try {
    const parsedUrl = new URL(url);
    const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;
    const response = await fetch(robotsUrl);

    if (!response.ok) {
      // If no robots.txt exists, assume crawling is allowed
      return true;
    }

    const robotsTxt = await response.text();
    const robots = robotsParser(robotsUrl, robotsTxt);

    // Use a common crawler user agent
    return (
      robots.isAllowed(url, "LinkedInBot") ?? true
    );
  } catch (error) {
    // If there's an error checking robots.txt, assume crawling is allowed
    return true;
  }
};

export const bulkCrawlWebsites = async (
  options: BulkCrawlOptions,
): Promise<BulkCrawlResponse> => {
  const { urls, maxRetries = DEFAULT_MAX_RETRIES } =
    options;

  const results = await Promise.all(
    options.urls.map(async (url) => {
      const result = await crawlWebsite({
        url,
        maxRetries: options.maxRetries,
        traceId: options.traceId,
      });
      return { url, result };
    }),
  );

  const allSuccessful = results.every(
    (r) => r.result.success,
  );

  if (!allSuccessful) {
    const errors = results
      .filter((r) => !r.result.success)
      .map(
        (r) =>
          `${r.url}: ${(r.result as CrawlErrorResponse).error}`,
      )
      .join("\n");

    return {
      results,
      success: false,
      error: `Failed to crawl some websites:\n${errors}`,
    };
  }

  return {
    results,
    success: true,
  } as BulkCrawlResponse;
};

export const crawlWebsite = cacheWithRedis(
  "crawlWebsite",
  async (
    options: CrawlOptions & { url: string; traceId?: string },
  ): Promise<CrawlResponse> => {
    const { url, maxRetries = DEFAULT_MAX_RETRIES, traceId } = options;
    let attempts = 0;
    
    // Create a Langfuse trace for this crawl operation
    const trace = langfuse?.trace({
      name: "crawl_website",
      input: { url, maxRetries },
      metadata: { traceId },
      sessionId: traceId,
    });

    try {
      // Check robots.txt before attempting to crawl
      const isAllowed = await checkRobotsTxt(url);
      if (!isAllowed) {
        const errorMsg = "Crawling disallowed by robots.txt";
        trace?.update({
          output: { success: false, error: errorMsg },
          metadata: { error: true, reason: "robots_txt" }
        });
        return {
          success: false,
          error: errorMsg,
        };
      }

      while (attempts < maxRetries) {
        try {
          const response = await fetch(url);

          if (response.ok) {
            const html = await response.text();
            const articleText = extractArticleText(html);
            const result = {
              success: true as const,
              data: articleText,
            };
            
            // Report success to Langfuse
            // Update the trace with success information
            trace?.update({
              output: { success: true, contentLength: articleText.length }
            });
            
            return result;
          }

          // Handle non-OK response
          attempts++;
          if (attempts === maxRetries) {
            const errorMsg = `Failed to fetch website after ${maxRetries} attempts: ${response.status} ${response.statusText}`;
            trace?.update({
              output: { success: false, error: errorMsg, status: response.status },
              metadata: { attempts: maxRetries, error: true }
            });
            return {
              success: false,
              error: errorMsg,
            };
          }

          // Exponential backoff: 0.5s, 1s, 2s, 4s, 8s max
          const delay = Math.min(
            MIN_DELAY_MS * Math.pow(2, attempts),
            MAX_DELAY_MS,
          );
          await setTimeout(delay);
        } catch (error) {
          attempts++;
          if (attempts === maxRetries) {
            const errorMsg = `Network error after ${maxRetries} attempts: ${error instanceof Error ? error.message : "Unknown error"}`;
            trace?.update({
              output: { success: false, error: errorMsg },
              metadata: { attempts: maxRetries, error: true }
            });
            return {
              success: false,
              error: errorMsg,
            };
          }
          const delay = Math.min(
            MIN_DELAY_MS * Math.pow(2, attempts),
            MAX_DELAY_MS,
          );
          await setTimeout(delay);
        }
      }

      // This should never be reached because we return in the loop
      const errorMsg = "Maximum retry attempts reached";
      trace?.update({
        output: { success: false, error: errorMsg },
        metadata: { error: true }
      });
      return {
        success: false,
        error: errorMsg,
      };
    } catch (error) {
      const errorMsg = `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      trace?.update({
        output: { success: false, error: errorMsg },
        metadata: { error: true, unexpected: true }
      });
      return {
        success: false,
        error: errorMsg,
      };
    }
  },
);
