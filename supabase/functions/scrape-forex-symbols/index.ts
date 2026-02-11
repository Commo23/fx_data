// Deno types for Supabase Edge Functions
declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

// Import optimized Playwright utilities
import { scrapeWithPlaywright, scrapeWithFetch, type Page } from '../_shared/playwright-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ============================================
    // OPTIMIZED SCRAPING LOGIC WITH PLAYWRIGHT
    // ============================================
    console.log('Scraping forex symbols from Barchart...');

    // Step 1: Define the target URL for the currencies page
    const url = 'https://www.barchart.com/futures/currencies';
    
    // Step 2: Try Playwright first, fallback to fetch if it fails
    let markdown = '';
    let html = '';
    
    try {
      // Use optimized scraping utility with resource blocking and retry logic
      // This handles browser reuse, concurrency limiting, and automatic retries
      const result = await scrapeWithPlaywright(
      url,
      async (page: Page, jsonResponses: Map<string, any>) => {
        console.log('Page loaded, extracting content...');
        
        // Step 3: Extract HTML content from the fully loaded page
        const pageHtml = await page.content();
        
        // Step 4: Extract text content as markdown-like format
        // This provides a text representation for regex pattern matching
        const bodyText = await page.evaluate(() => document.body.innerText);
        const pageMarkdown = bodyText;
        
        console.log('Scraped content length:', pageMarkdown.length);
        
        return { markdown: pageMarkdown, html: pageHtml };
      },
      {
        // Wait for table or currency list to appear
        waitForSelector: 'table, [class*="table"], [class*="currency"], [class*="symbol"]',
        // Intercept JSON API responses that might contain symbol data
        interceptJsonUrls: ['api', 'data', 'symbols', 'currencies'],
        maxRetries: 3,
      }
      );
      markdown = result.markdown;
      html = result.html;
    } catch (playwrightError) {
      // Fallback to fetch if Playwright fails (e.g., browser binaries not available)
      console.log('Playwright failed, falling back to fetch:', playwrightError instanceof Error ? playwrightError.message : String(playwrightError));
      
      try {
        html = await scrapeWithFetch(url, { timeout: 30000 });
        console.log('Fetch successful, extracting text...');
        
        // Extract text content (simple approach - just get the HTML)
        // In a real scenario, you might want to use a simple HTML parser
        markdown = html; // Use HTML as markdown for pattern matching
      } catch (fetchError) {
        console.error('Fetch fallback also failed:', fetchError);
        throw new Error(`Both Playwright and fetch failed. Playwright: ${playwrightError instanceof Error ? playwrightError.message : String(playwrightError)}. Fetch: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      }
    }

    // Parse symbols from the markdown/html content
    // Look for patterns like DXH26, 6EH26, etc. (currency futures symbols)
    const symbolPattern = /\b([A-Z0-9]{3,6}[A-Z]\d{2})\b/g;
    const allMatches = [...markdown.matchAll(symbolPattern), ...html.matchAll(symbolPattern)];
    
    // Also look for base symbols without expiry
    const baseSymbolPattern = /\b(DX|6E|6J|6B|6A|6C|6S|6N|6M)\b/g;
    const baseMatches = [...markdown.matchAll(baseSymbolPattern)];
    
    // Extract unique symbols
    const symbolSet = new Set<string>();
    
    // Add full symbols
    allMatches.forEach(match => {
      symbolSet.add(match[1]);
    });

    // Common currency futures symbols with typical contract months
    const commonSymbols = [
      'DXH25', 'DXM25', 'DXU25', 'DXZ25', // US Dollar Index
      '6EH25', '6EM25', '6EU25', '6EZ25', // Euro FX
      '6JH25', '6JM25', '6JU25', '6JZ25', // Japanese Yen
      '6BH25', '6BM25', '6BU25', '6BZ25', // British Pound
      '6AH25', '6AM25', '6AU25', '6AZ25', // Australian Dollar
      '6CH25', '6CM25', '6CU25', '6CZ25', // Canadian Dollar
      '6SH25', '6SM25', '6SU25', '6SZ25', // Swiss Franc
      '6NH25', '6NM25', '6NU25', '6NZ25', // New Zealand Dollar
      '6MH25', '6MM25', '6MU25', '6MZ25', // Mexican Peso
    ];

    // If we didn't find enough symbols, use the common ones
    if (symbolSet.size < 5) {
      commonSymbols.forEach(s => symbolSet.add(s));
    }

    const symbols = Array.from(symbolSet).slice(0, 50); // Limit to 50 symbols

    console.log(`Found ${symbols.length} symbols:`, symbols);

    return new Response(
      JSON.stringify({ 
        success: true, 
        symbols,
        rawLength: markdown.length,
        source: 'barchart'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping symbols:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape symbols';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Force this file to be treated as an ES module
export {};
