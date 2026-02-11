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

interface CurrencyFuture {
  symbol: string;
  name: string;
  contract: string;
  latest: string;
  change?: string;
  changePercent?: string;
}

// Currency futures mapping with full names
const CURRENCY_FUTURES = {
  'DX': { name: 'US Dollar Index', baseSymbol: 'DX' },
  '6E': { name: 'Euro FX', baseSymbol: '6E' },
  '6J': { name: 'Japanese Yen', baseSymbol: '6J' },
  '6B': { name: 'British Pound', baseSymbol: '6B' },
  '6A': { name: 'Australian Dollar', baseSymbol: '6A' },
  '6C': { name: 'Canadian Dollar', baseSymbol: '6C' },
  '6S': { name: 'Swiss Franc', baseSymbol: '6S' },
  '6N': { name: 'New Zealand Dollar', baseSymbol: '6N' },
  '6M': { name: 'Mexican Peso', baseSymbol: '6M' },
  '6L': { name: 'Brazilian Real', baseSymbol: '6L' },
  '6R': { name: 'Russian Ruble', baseSymbol: '6R' },
  '6Z': { name: 'South African Rand', baseSymbol: '6Z' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ============================================
    // OPTIMIZED SCRAPING LOGIC WITH PLAYWRIGHT
    // ============================================
    console.log('Scraping all forex data from Barchart currencies page...');

    // Step 1: Define the target URL for the currencies page
    const url = 'https://www.barchart.com/futures/currencies';
    
    // Step 2: Try Playwright first, fallback to fetch if it fails
    let markdown = '';
    
    try {
      // Use optimized scraping utility with resource blocking and retry logic
      // This handles browser reuse, concurrency limiting, and automatic retries
      markdown = await scrapeWithPlaywright(
      url,
      async (page: Page, jsonResponses: Map<string, any>) => {
        console.log('Page loaded, extracting content...');
        
        // Step 3: Extract text content as markdown-like format
        // This provides a text representation for parsing currency futures data
        const bodyText = await page.evaluate(() => document.body.innerText);
        const markdown = bodyText;
        
        console.log('Scraped main page, content length:', markdown.length);
        
        return markdown;
      },
      {
        // Wait for table or currency list to appear
        waitForSelector: 'table, [class*="table"], [class*="currency"]',
        // Intercept JSON API responses that might contain currency data
        interceptJsonUrls: ['api', 'data', 'currencies', 'futures'],
        maxRetries: 3,
      }
      );
    } catch (playwrightError) {
      // Fallback to fetch if Playwright fails (e.g., browser binaries not available)
      console.log('Playwright failed, falling back to fetch:', playwrightError instanceof Error ? playwrightError.message : String(playwrightError));
      
      try {
        const html = await scrapeWithFetch(url, { timeout: 30000 });
        console.log('Fetch successful, extracting text...');
        
        // Extract text content (simple approach)
        // In a real scenario, you might want to use a simple HTML parser
        markdown = html; // Use HTML as markdown for pattern matching
      } catch (fetchError) {
        console.error('Fetch fallback also failed:', fetchError);
        throw new Error(`Both Playwright and fetch failed. Playwright: ${playwrightError instanceof Error ? playwrightError.message : String(playwrightError)}. Fetch: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      }
    }

    // Parse the data from the markdown
    const currencies: CurrencyFuture[] = [];
    const lines = markdown.split('\n');
    
    let inTable = false;
    let headerFound = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.includes('|')) {
        const cells = trimmedLine.split('|').map((c: string) => c.trim()).filter((c: string) => c.length > 0);
        
        // Look for header row with columns like Symbol, Last, Change, etc.
        if (!headerFound && cells.some((c: string) => 
          c.toLowerCase().includes('symbol') || 
          c.toLowerCase().includes('contract') ||
          c.toLowerCase().includes('last') ||
          c.toLowerCase().includes('name')
        )) {
          headerFound = true;
          inTable = true;
          continue;
        }
        
        // Skip separator rows
        if (cells.some((c: string) => c.match(/^[-:]+$/))) {
          continue;
        }
        
        // Parse data rows
        if (inTable && cells.length >= 2) {
          // Try to extract symbol and price
          let symbol = '';
          let name = '';
          let latest = '';
          let change = '';
          
          for (const cell of cells) {
            // Check if this looks like a symbol (e.g., DXH25, 6EH25)
            const symbolMatch = cell.match(/\b([A-Z0-9]{2,4}[A-Z]\d{2})\b/);
            if (symbolMatch && !symbol) {
              symbol = symbolMatch[1];
              // Try to get the name from CURRENCY_FUTURES
              const baseSymbol = symbol.slice(0, 2);
              const currencyInfo = CURRENCY_FUTURES[baseSymbol as keyof typeof CURRENCY_FUTURES];
              if (currencyInfo) {
                name = currencyInfo.name;
              }
            }
            
            // Check if this looks like a price
            const priceMatch = cell.match(/^(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+\.\d+)$/);
            if (priceMatch && !latest) {
              latest = priceMatch[1];
            }
            
            // Check for change (with +/- prefix)
            const changeMatch = cell.match(/^([+-]?\d+\.?\d*)$/);
            if (changeMatch && latest && !change) {
              change = changeMatch[1];
            }
            
            // Check if cell contains currency name
            for (const [key, info] of Object.entries(CURRENCY_FUTURES)) {
              if (cell.toLowerCase().includes(info.name.toLowerCase())) {
                name = info.name;
                break;
              }
            }
          }
          
          if (symbol && latest) {
            currencies.push({
              symbol,
              name: name || symbol,
              contract: symbol,
              latest,
              change: change || undefined,
            });
          }
        }
      }
    }

    // Also try regex patterns for fallback extraction
    // Pattern: Symbol followed by price
    const patterns = [
      /\[([A-Z0-9]{2,6}[A-Z]\d{2})\][^\d]*(\d+\.?\d*)/g,
      /\b([A-Z0-9]{2,4}[A-Z]\d{2})\b[^0-9]*?(\d{2,6}\.?\d{0,4})/g,
    ];
    
    for (const pattern of patterns) {
      const matches = [...markdown.matchAll(pattern)];
      for (const match of matches) {
        const symbol = match[1];
        const price = match[2];
        
        // Skip if we already have this symbol
        if (currencies.some(c => c.symbol === symbol)) continue;
        
        // Validate price looks reasonable
        const priceNum = parseFloat(price);
        if (priceNum > 0 && priceNum < 1000000) {
          const baseSymbol = symbol.slice(0, 2);
          const currencyInfo = CURRENCY_FUTURES[baseSymbol as keyof typeof CURRENCY_FUTURES];
          
          currencies.push({
            symbol,
            name: currencyInfo?.name || symbol,
            contract: symbol,
            latest: price,
          });
        }
      }
    }

    // If still no data, provide sample data based on common currency futures
    if (currencies.length === 0) {
      console.log('No data extracted from scrape, returning sample structure');
      
      // Return empty but successful response with metadata
      return new Response(
        JSON.stringify({ 
          success: true, 
          currencies: [],
          message: 'Scraping completed but no table data found. The page structure may have changed.',
          rawLength: markdown.length,
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduplicate by symbol
    const uniqueCurrencies = currencies.reduce((acc, curr) => {
      if (!acc.some(c => c.symbol === curr.symbol)) {
        acc.push(curr);
      }
      return acc;
    }, [] as CurrencyFuture[]);

    console.log(`Extracted ${uniqueCurrencies.length} unique currency futures`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        currencies: uniqueCurrencies,
        count: uniqueCurrencies.length,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping forex data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape forex data';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Force this file to be treated as an ES module
export {};
