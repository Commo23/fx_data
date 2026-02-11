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

interface OptionData {
  strike: string;
  type: 'C' | 'P'; // Call or Put
  latest: string;
  iv: string; // Implied Volatility
}

// Month codes for futures contracts
const MONTH_CODES = 'FGHJKMNQUVXZ';

// Convert base symbol to Barchart format for options URL
function convertSymbolForOptions(baseSymbol: string): string {
  const symbolMap: Record<string, string> = {
    '6E': 'E6',
    '6J': 'J6',
    '6B': 'B6',
    '6A': 'A6',
    '6C': 'C6',
    '6S': 'S6',
    '6N': 'N6',
    '6M': 'M6',
    '6L': 'L6',
    '6Z': 'Z6',
    'DX': 'DX',
  };
  return symbolMap[baseSymbol] || baseSymbol;
}

// Build options contract symbol
function buildOptionsContractSymbol(baseSymbol: string, monthCode: string, year: number): string {
  const convertedSymbol = convertSymbolForOptions(baseSymbol);
  const yearStr = year.toString().slice(-2);
  return `${convertedSymbol}${monthCode}${yearStr}`;
}

// Validate that options data contains actual numeric values, not navigation text
function isValidOptionsData(options: any[]): boolean {
  if (!options || options.length === 0) return false;
  
  // Check if at least one option has valid numeric data
  const validOptions = options.filter(opt => {
    if (!opt.strike || !opt.latest || !opt.iv) return false;
    
    // Strike should be numeric
    const strikeNum = parseFloat(String(opt.strike).replace(/[^0-9.-]/g, ''));
    if (isNaN(strikeNum) || strikeNum <= 0) return false;
    
    // Latest should be numeric (can be 0)
    const latestNum = parseFloat(String(opt.latest).replace(/[^0-9.-]/g, ''));
    if (isNaN(latestNum)) return false;
    
    // IV should be numeric or percentage
    const ivStr = String(opt.iv).replace(/%/g, '');
    const ivNum = parseFloat(ivStr.replace(/[^0-9.-]/g, ''));
    if (isNaN(ivNum) || ivNum < 0) return false;
    
    // Type should be C or P
    const type = String(opt.type).toUpperCase().trim();
    if (type !== 'C' && type !== 'P') return false;
    
    // Reject common navigation text
    const invalidTexts = ['watchlist', 'dashboard', 'login', 'sign up', 'menu', 'navigation'];
    const strikeLower = String(opt.strike).toLowerCase();
    const latestLower = String(opt.latest).toLowerCase();
    if (invalidTexts.some(text => strikeLower.includes(text) || latestLower.includes(text))) {
      return false;
    }
    
    return true;
  });
  
  return validOptions.length > 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error('Failed to parse request body:', e);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { baseSymbol, monthCode, year } = body || {};

    if (!baseSymbol || !monthCode || !year) {
      return new Response(
        JSON.stringify({ success: false, error: 'baseSymbol, monthCode, and year are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // OPTIMIZED SCRAPING LOGIC WITH PLAYWRIGHT
    // ============================================
    // Step 1: Build the options contract symbol and target URL
    const contractSymbol = buildOptionsContractSymbol(baseSymbol, monthCode, year);
    console.log('Options contract symbol:', contractSymbol);

    // Use the volatility-greeks page which shows options data
    // URL format: https://www.barchart.com/futures/quotes/E6H26/volatility-greeks?futuresOptionsView=merged&moneyness=allRows
    const url = `https://www.barchart.com/futures/quotes/${contractSymbol}/volatility-greeks?futuresOptionsView=merged&moneyness=allRows`;
    console.log('Scraping options for:', contractSymbol, 'URL:', url);

    // Step 2: Try Playwright first, fallback to fetch if it fails
    let options: any[] = [];
    
    try {
      // Use optimized scraping utility with resource blocking and retry logic
      // This handles browser reuse, concurrency limiting, and automatic retries
      options = await scrapeWithPlaywright(
      url,
      async (page: Page, jsonResponses: Map<string, any>) => {
        console.log('Page loaded, extracting HTML content...');
        
        // Try to extract data from JSON responses first (if available)
        let optionsFromJson: any[] = [];
        for (const [responseUrl, jsonData] of jsonResponses.entries()) {
          console.log(`Found JSON response: ${responseUrl}`);
          // Try to extract options from JSON if the structure matches
          if (Array.isArray(jsonData)) {
            optionsFromJson = jsonData;
          } else if (jsonData?.data && Array.isArray(jsonData.data)) {
            optionsFromJson = jsonData.data;
          } else if (jsonData?.options && Array.isArray(jsonData.options)) {
            optionsFromJson = jsonData.options;
          }
        }
        
        // Step 3: Extract HTML content from the fully loaded page
        const html = await page.content();
        
        // Step 4: Parse options from HTML table
        // This uses the existing parseHtmlOptionsTable function to extract structured data
        const htmlOptions = parseHtmlOptionsTable(html);
        console.log(`Found ${htmlOptions.length} options in HTML`);
        
        // Step 5: Also try markdown parsing as a fallback method
        const markdownOptions = parseMarkdownOptionsTable(html);
        console.log(`Found ${markdownOptions.length} options via markdown parsing`);
        
        // Step 6: Merge options from all sources (JSON, HTML, markdown)
        // Prefer JSON data if valid, then HTML, then markdown
        let finalOptions: any[] = [];
        
        if (optionsFromJson.length > 0 && isValidOptionsData(optionsFromJson)) {
          finalOptions = optionsFromJson;
          console.log(`Using ${optionsFromJson.length} options from JSON`);
        } else if (htmlOptions.length > markdownOptions.length && isValidOptionsData(htmlOptions)) {
          finalOptions = htmlOptions;
        } else if (isValidOptionsData(markdownOptions)) {
          finalOptions = markdownOptions;
        } else if (htmlOptions.length > 0) {
          finalOptions = htmlOptions;
        } else if (markdownOptions.length > 0) {
          finalOptions = markdownOptions;
        }
        
        return finalOptions;
      },
      {
        // Wait for options table selector to appear
        waitForSelector: 'table, [class*="table"], [class*="options"], [class*="strike"]',
        // Intercept JSON API responses that might contain options data
        interceptJsonUrls: ['api', 'data', 'options', 'volatility', 'greeks'],
        maxRetries: 3,
      }
      );
    } catch (playwrightError) {
      // Fallback to fetch if Playwright fails (e.g., browser binaries not available)
      console.log('Playwright failed, falling back to fetch:', playwrightError instanceof Error ? playwrightError.message : String(playwrightError));
      
      try {
        const html = await scrapeWithFetch(url, { timeout: 30000 });
        console.log('Fetch successful, parsing HTML...');
        
        // Parse options from HTML
        const htmlOptions = parseHtmlOptionsTable(html);
        console.log(`Found ${htmlOptions.length} options in HTML via fetch fallback`);
        
        const markdownOptions = parseMarkdownOptionsTable(html);
        console.log(`Found ${markdownOptions.length} options via markdown parsing`);
        
        // Use the source with more valid options
        if (htmlOptions.length > markdownOptions.length && isValidOptionsData(htmlOptions)) {
          options = htmlOptions;
        } else if (isValidOptionsData(markdownOptions)) {
          options = markdownOptions;
        } else if (htmlOptions.length > 0) {
          options = htmlOptions;
        } else if (markdownOptions.length > 0) {
          options = markdownOptions;
        }
      } catch (fetchError) {
        console.error('Fetch fallback also failed:', fetchError);
        // Instead of throwing, return empty options array so the function can still return a valid response
        console.log('Both Playwright and fetch failed, returning empty options array');
        options = [];
      }
    }

    console.log(`Total options before validation: ${options.length}`);
    
    // Map and filter valid options with validation
    const optionsData: OptionData[] = options
      .map((opt: any) => {
        // Normalize the data
        const strike = String(opt.strike || '').trim();
        const type = String(opt.type || '').toUpperCase().trim();
        const latest = String(opt.latest || '').trim();
        const iv = String(opt.iv || '').trim();
        
        return { strike, type, latest, iv, original: opt };
      })
      .filter((opt: any) => {
        // Basic validation - all fields must exist
        if (!opt.strike || !opt.type || !opt.latest || !opt.iv) {
          console.log('Rejected option - missing field:', opt);
          return false;
        }
        
        // Reject obvious navigation text
        const invalidTexts = ['watchlist', 'dashboard', 'login', 'sign up', 'menu', 'navigation', 'retour', 'back'];
        const strikeLower = opt.strike.toLowerCase();
        const latestLower = opt.latest.toLowerCase();
        const ivLower = opt.iv.toLowerCase();
        if (invalidTexts.some(text => 
          strikeLower.includes(text) || latestLower.includes(text) || ivLower.includes(text)
        )) {
          console.log('Rejected option - contains navigation text:', opt);
          return false;
        }
        
        // Validate strike is numeric (must be positive)
        const strikeNum = parseFloat(opt.strike.replace(/[^0-9.-]/g, ''));
        if (isNaN(strikeNum) || strikeNum <= 0) {
          console.log('Rejected option - invalid strike:', opt);
          return false;
        }
        
        // Validate latest is numeric (can be 0)
        const latestNum = parseFloat(opt.latest.replace(/[^0-9.-]/g, ''));
        if (isNaN(latestNum)) {
          console.log('Rejected option - invalid latest:', opt);
          return false;
        }
        
        // Validate IV is numeric or percentage
        const ivStr = opt.iv.replace(/%/g, '');
        const ivNum = parseFloat(ivStr.replace(/[^0-9.-]/g, ''));
        if (isNaN(ivNum) || ivNum < 0) {
          console.log('Rejected option - invalid IV:', opt);
          return false;
        }
        
        // Validate type is C or P (allow variations like "CALL" -> "C", "PUT" -> "P")
        let normalizedType = opt.type;
        if (normalizedType.startsWith('C') || normalizedType.includes('CALL')) {
          normalizedType = 'C';
        } else if (normalizedType.startsWith('P') || normalizedType.includes('PUT')) {
          normalizedType = 'P';
        } else if (normalizedType !== 'C' && normalizedType !== 'P') {
          console.log('Rejected option - invalid type:', opt);
          return false;
        }
        
        return true;
      })
      .map((opt: any) => {
        // Normalize type
        let normalizedType: 'C' | 'P' = 'P';
        if (opt.type.startsWith('C') || opt.type.includes('CALL')) {
          normalizedType = 'C';
        } else if (opt.type.startsWith('P') || opt.type.includes('PUT')) {
          normalizedType = 'P';
        }
        
        return {
          strike: opt.strike,
          type: normalizedType,
          latest: opt.latest,
          iv: opt.iv,
        };
      });

    // Deduplicate by strike and type
    const seen = new Set<string>();
    const dedupedOptions = optionsData.filter((opt: OptionData) => {
      const key = `${opt.strike}-${opt.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by strike price (ascending)
    dedupedOptions.sort((a: OptionData, b: OptionData) => {
      const strikeA = parseFloat(a.strike.replace(/[^0-9.-]/g, ''));
      const strikeB = parseFloat(b.strike.replace(/[^0-9.-]/g, ''));
      return strikeA - strikeB;
    });

    console.log(`Final extracted ${dedupedOptions.length} options for ${contractSymbol}`);

    // Return response even if no options found (success: true with empty array)
    return new Response(
      JSON.stringify({
        success: true,
        baseSymbol,
        contractSymbol,
        maturity: { monthCode, year },
        data: dedupedOptions,
        count: dedupedOptions.length,
        message: dedupedOptions.length === 0 
          ? 'Aucune option trouvée pour cette maturité. Les données peuvent être en cours de chargement ou non disponibles.'
          : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping options:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape options';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to parse markdown options table
function parseMarkdownOptionsTable(markdown: string): any[] {
  const options: any[] = [];
  const lines = markdown.split('\n');
  
  let inTable = false;
  let headerFound = false;
  let headerIndexes: Record<string, number> = {};
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.includes('|')) {
      const cells = trimmedLine.split('|').map((c: string) => c.trim()).filter((c: string) => c.length > 0);
      
      // Detect header row
      if (!headerFound && cells.some((c: string) => 
        c.toLowerCase().includes('strike') ||
        c.toLowerCase().includes('type') ||
        c.toLowerCase().includes('last') ||
        c.toLowerCase().includes('latest') ||
        c.toLowerCase().includes('iv') ||
        c.toLowerCase().includes('volatility')
      )) {
        headerFound = true;
        inTable = true;
        // Map header names to indexes
        cells.forEach((cell, idx) => {
          const lower = cell.toLowerCase();
          if (lower.includes('strike')) headerIndexes.strike = idx;
          if (lower.includes('type') || lower.includes('call') || lower.includes('put')) headerIndexes.type = idx;
          if (lower.includes('last') || lower.includes('latest') || lower.includes('price')) headerIndexes.latest = idx;
          if (lower.includes('iv') || (lower.includes('implied') && lower.includes('vol'))) headerIndexes.iv = idx;
        });
        continue;
      }
      
      // Skip separator rows
      if (cells.some((c: string) => c.match(/^[-:]+$/))) {
        continue;
      }
      
      // Parse data rows
      if (inTable && cells.length >= 3) {
        const strike = cells[headerIndexes.strike] || cells[0];
        const typeCell = cells[headerIndexes.type] || cells[1];
        const latest = cells[headerIndexes.latest] || cells[2];
        const iv = cells[headerIndexes.iv] || cells[3];
        
        // Validate we have required fields and they are numeric
        if (strike && latest && iv) {
          // Check if strike is numeric
          const strikeNum = parseFloat(String(strike).replace(/[^0-9.-]/g, ''));
          if (isNaN(strikeNum) || strikeNum <= 0) continue;
          
          // Check if latest is numeric
          const latestNum = parseFloat(String(latest).replace(/[^0-9.-]/g, ''));
          if (isNaN(latestNum)) continue;
          
          // Check if IV is numeric
          const ivStr = String(iv).replace(/%/g, '');
          const ivNum = parseFloat(ivStr.replace(/[^0-9.-]/g, ''));
          if (isNaN(ivNum) || ivNum < 0) continue;
          
          // Reject navigation text
          const invalidTexts = ['watchlist', 'dashboard', 'login', 'menu', 'navigation', 'retour'];
          const strikeLower = String(strike).toLowerCase();
          const latestLower = String(latest).toLowerCase();
          if (invalidTexts.some(text => strikeLower.includes(text) || latestLower.includes(text))) {
            continue;
          }
          
          // Determine type (Call or Put)
          const type = typeCell && (typeCell.toUpperCase().includes('C') || typeCell.toUpperCase().includes('CALL')) ? 'C' : 'P';
          
          options.push({
            strike: strike.trim(),
            type,
            latest: latest.trim(),
            iv: iv.trim(),
          });
        }
      }
    }
  }
  
  return options;
}

// Helper function to parse HTML options table
function parseHtmlOptionsTable(html: string): any[] {
  const options: any[] = [];
  
  // Try to find table rows with options data
  // Look for patterns like <tr> with strike, type, latest, iv
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = [...html.matchAll(rowPattern)];
  
  let headerFound = false;
  let headerIndexes: Record<string, number> = {};
  
  for (const rowMatch of rows) {
    const rowHtml = rowMatch[1];
    
    // Extract text content from cells
    const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells = [...rowHtml.matchAll(cellPattern)].map(match => {
      // Remove HTML tags and get text content
      return match[1].replace(/<[^>]+>/g, '').trim();
    }).filter(cell => cell.length > 0);
    
    if (cells.length === 0) continue;
    
    // Detect header row
    if (!headerFound && cells.some(cell => {
      const lower = cell.toLowerCase();
      return lower.includes('strike') || lower.includes('type') || 
             lower.includes('last') || lower.includes('iv') || 
             lower.includes('volatility');
    })) {
      headerFound = true;
      cells.forEach((cell, idx) => {
        const lower = cell.toLowerCase();
        if (lower.includes('strike')) headerIndexes.strike = idx;
        if (lower.includes('type') || lower.includes('call') || lower.includes('put')) headerIndexes.type = idx;
        if (lower.includes('last') || lower.includes('latest') || lower.includes('price')) headerIndexes.latest = idx;
        if (lower.includes('iv') || (lower.includes('implied') && lower.includes('vol'))) headerIndexes.iv = idx;
      });
      continue;
    }
    
    // Parse data rows
    if (headerFound && cells.length >= 3) {
      const strike = cells[headerIndexes.strike] || cells[0];
      const typeCell = cells[headerIndexes.type] || cells[1];
      const latest = cells[headerIndexes.latest] || cells[2];
      const iv = cells[headerIndexes.iv] || cells[3];
      
      // Validate we have required fields and they are numeric
      if (strike && latest && iv) {
        // Check if strike is numeric
        const strikeNum = parseFloat(String(strike).replace(/[^0-9.-]/g, ''));
        if (isNaN(strikeNum) || strikeNum <= 0) continue;
        
        // Check if latest is numeric
        const latestNum = parseFloat(String(latest).replace(/[^0-9.-]/g, ''));
        if (isNaN(latestNum)) continue;
        
        // Check if IV is numeric
        const ivStr = String(iv).replace(/%/g, '');
        const ivNum = parseFloat(ivStr.replace(/[^0-9.-]/g, ''));
        if (isNaN(ivNum) || ivNum < 0) continue;
        
        // Reject navigation text
        const invalidTexts = ['watchlist', 'dashboard', 'login', 'menu', 'navigation', 'retour'];
        const strikeLower = String(strike).toLowerCase();
        const latestLower = String(latest).toLowerCase();
        if (invalidTexts.some(text => strikeLower.includes(text) || latestLower.includes(text))) {
          continue;
        }
        
        // Determine type (Call or Put)
        const type = typeCell && (typeCell.toUpperCase().includes('C') || typeCell.toUpperCase().includes('CALL')) ? 'C' : 'P';
        
        options.push({
          strike: strike.trim(),
          type,
          latest: latest.trim(),
          iv: iv.trim(),
        });
      }
    }
  }
  
  return options;
}

