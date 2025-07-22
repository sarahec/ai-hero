import { z } from "zod";
import { bulkCrawlWebsites, type CrawlErrorResponse, type CrawlSuccessResponse, type BulkCrawlResponse } from "~/server/crawl/crawler";

/**
 * Scrapes the content of one or more web pages and returns the extracted text in markdown format.
 * Automatically respects robots.txt rules and handles rate limiting with exponential backoff.
 * Results are cached to improve performance and reduce load on target websites.
 * 
 * @param urls - An array of URLs to scrape
 * @returns An object containing the scraped content for each URL and any errors that occurred
 */
interface ScrapeResult {
  url: string;
  success: boolean;
  data?: string;
  error?: string;
}

export const scrapePages = async (urls: string[]) => {
  try {
    const result = await bulkCrawlWebsites({ urls });
    
    if (!result.success) {
      const results: ScrapeResult[] = result.results.map(r => {
        if (r.result.success) {
          return {
            url: r.url,
            success: true,
            data: r.result.data
          };
        } else {
          return {
            url: r.url,
            success: false,
            error: r.result.error
          };
        }
      });
      
      return {
        success: false as const,
        error: result.error,
        results
      };
    }

    const results: ScrapeResult[] = result.results.map(r => {
      // Type guard function to check if the result is a success
      const isSuccess = (result: any): result is CrawlSuccessResponse => 
        result && result.success === true && 'data' in result;
      
      if (isSuccess(r.result)) {
        return {
          url: r.url,
          success: true,
          data: r.result.data
        };
      } else {
        // TypeScript now knows this must be an error response
        return {
          url: r.url,
          success: false,
          error: (r.result as CrawlErrorResponse).error
        };
      }
    });

    return {
      success: true as const,
      results
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred while scraping pages';
    const results: ScrapeResult[] = urls.map(url => ({
      url,
      success: false,
      error: 'Failed to process due to an unexpected error'
    }));
    
    return {
      success: false as const,
      error: errorMessage,
      results
    };
  }
};

// Zod schema for the tool input
export const scrapePagesSchema = z.object({
  urls: z.array(z.string().url("Invalid URL format")).min(1, "At least one URL is required")
});

// Type for the tool input
export type ScrapePagesInput = z.infer<typeof scrapePagesSchema>;

// Type for the tool output
export type ScrapePagesOutput = Awaited<ReturnType<typeof scrapePages>>;
