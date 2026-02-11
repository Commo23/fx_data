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

interface FuturesData {
  contract: string;
  latest: string;
  change?: string;
  high?: string;
  low?: string;
  open?: string;
  volume?: string;
  changePercent?: string;
}

// Month codes for futures contracts
const MONTH_CODES = 'FGHJKMNQUVXZ';

// Helper function to parse HTML table and extract ALL contracts
function parseHtmlTable(html: string, symbol: string): any[] {
  const contracts: any[] = [];
  
  // Find all table rows
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
      return lower.includes('contract') || lower.includes('symbol') || 
             lower.includes('last') || lower.includes('change') ||
             lower.includes('high') || lower.includes('low') || 
             lower.includes('open') || lower.includes('volume');
    })) {
      headerFound = true;
      cells.forEach((cell, idx) => {
        const lower = cell.toLowerCase();
        if (lower.includes('contract') || lower.includes('symbol')) headerIndexes.contract = idx;
        if (lower.includes('last') || lower.includes('latest')) headerIndexes.last = idx;
        if (lower.includes('change') && !lower.includes('%')) headerIndexes.change = idx;
        if (lower.includes('high')) headerIndexes.high = idx;
        if (lower.includes('low')) headerIndexes.low = idx;
        if (lower.includes('open')) headerIndexes.open = idx;
        if (lower.includes('volume')) headerIndexes.volume = idx;
        if (lower.includes('change') && lower.includes('%')) headerIndexes.changePercent = idx;
      });
      continue;
    }
    
    // Parse data rows
    if (headerFound && cells.length >= 2) {
      const contractCell = cells[headerIndexes.contract] || cells[0];
      const lastCell = cells[headerIndexes.last] || cells[1];
      
      // Check if contract matches our symbol pattern (more flexible matching)
      if (contractCell) {
        // Try exact match first
        const exactMatch = contractCell.match(new RegExp(`^${symbol}[${MONTH_CODES}]\\d{2}$`, 'i'));
        // Also try to find contract pattern anywhere in the cell
        const patternMatch = contractCell.match(new RegExp(`${symbol}[${MONTH_CODES}]\\d{2}`, 'i'));
        
        if (exactMatch || patternMatch) {
          const contractSymbol = (exactMatch ? exactMatch[0] : patternMatch![0]).toUpperCase();
          
          contracts.push({
            contract: contractSymbol,
            last: lastCell || undefined,
            change: cells[headerIndexes.change] || undefined,
            high: cells[headerIndexes.high] || undefined,
            low: cells[headerIndexes.low] || undefined,
            open: cells[headerIndexes.open] || undefined,
            volume: cells[headerIndexes.volume] || undefined,
            changePercent: cells[headerIndexes.changePercent] || undefined,
          });
        }
      }
    }
  }
  
  // Also try regex pattern matching in the entire HTML to catch any missed contracts
  const contractPattern = new RegExp(`(${symbol}[${MONTH_CODES}]\\d{2})`, 'gi');
  const allContractMatches = [...html.matchAll(contractPattern)];
  const foundContracts = new Set<string>();
  
  // Add contracts found via table parsing
  contracts.forEach(c => foundContracts.add(c.contract));
  
  // Look for additional contracts in the HTML that might have been missed
  for (const match of allContractMatches) {
    const contractSymbol = match[1].toUpperCase();
    if (!foundContracts.has(contractSymbol)) {
      // Try to find price near this contract symbol
      const contractIndex = match.index || 0;
      const context = html.substring(Math.max(0, contractIndex - 200), Math.min(html.length, contractIndex + 500));
      
      // Look for price patterns near the contract
      const pricePatterns = [
        /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g,
        /(\d+\.\d+)/g,
      ];
      
      let price = '';
      for (const pricePattern of pricePatterns) {
        const priceMatches = [...context.matchAll(pricePattern)];
        if (priceMatches.length > 0) {
          // Take the first reasonable price after the contract
          const afterContract = context.substring(context.indexOf(match[1]) + match[1].length);
          const afterMatches = [...afterContract.matchAll(pricePattern)];
          if (afterMatches.length > 0) {
            price = afterMatches[0][1];
            break;
          }
        }
      }
      
      if (price || contracts.length === 0) {
        contracts.push({
          contract: contractSymbol,
          last: price || undefined,
        });
        foundContracts.add(contractSymbol);
      }
    }
  }
  
  return contracts;
}

// Helper function to parse markdown table
function parseMarkdownTable(markdown: string, symbol: string): any[] {
  const contracts: any[] = [];
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
        c.toLowerCase().includes('contract') || 
        c.toLowerCase().includes('symbol') ||
        c.toLowerCase().includes('last') ||
        c.toLowerCase().includes('change')
      )) {
        headerFound = true;
        inTable = true;
        // Map header names to indexes
        cells.forEach((cell, idx) => {
          const lower = cell.toLowerCase();
          if (lower.includes('contract') || lower.includes('symbol')) headerIndexes.contract = idx;
          if (lower.includes('last') || lower.includes('latest')) headerIndexes.last = idx;
          if (lower.includes('change') && !lower.includes('%')) headerIndexes.change = idx;
          if (lower.includes('high')) headerIndexes.high = idx;
          if (lower.includes('low')) headerIndexes.low = idx;
          if (lower.includes('open')) headerIndexes.open = idx;
          if (lower.includes('volume')) headerIndexes.volume = idx;
          if (lower.includes('change') && lower.includes('%')) headerIndexes.changePercent = idx;
        });
        continue;
      }
      
      // Skip separator rows
      if (cells.some((c: string) => c.match(/^[-:]+$/))) {
        continue;
      }
      
      // Parse data rows
      if (inTable && cells.length >= 2) {
        const contractCell = cells[headerIndexes.contract] || cells[0];
        const lastCell = cells[headerIndexes.last] || cells[1];
        
        // More flexible contract matching
        if (contractCell) {
          const exactMatch = contractCell.match(new RegExp(`^${symbol}[${MONTH_CODES}]\\d{2}$`, 'i'));
          const patternMatch = contractCell.match(new RegExp(`${symbol}[${MONTH_CODES}]\\d{2}`, 'i'));
          
          if (exactMatch || patternMatch) {
            const contractSymbol = (exactMatch ? exactMatch[0] : patternMatch![0]).toUpperCase();
            
            contracts.push({
              contract: contractSymbol,
              last: lastCell,
              change: cells[headerIndexes.change] || undefined,
              high: cells[headerIndexes.high] || undefined,
              low: cells[headerIndexes.low] || undefined,
              open: cells[headerIndexes.open] || undefined,
              volume: cells[headerIndexes.volume] || undefined,
              changePercent: cells[headerIndexes.changePercent] || undefined,
            });
          }
        }
      }
    }
  }
  
  // Also use regex to find all contract patterns in markdown
  const contractPattern = new RegExp(`\\b(${symbol}[${MONTH_CODES}]\\d{2})\\b`, 'gi');
  const allMatches = [...markdown.matchAll(contractPattern)];
  const foundContracts = new Set<string>();
  
  contracts.forEach(c => foundContracts.add(c.contract));
  
  // Add any contracts found via regex that weren't in the table
  for (const match of allMatches) {
    const contractSymbol = match[1].toUpperCase();
    if (!foundContracts.has(contractSymbol)) {
      contracts.push({
        contract: contractSymbol,
        last: undefined, // Will be filled from table if available
      });
      foundContracts.add(contractSymbol);
    }
  }
  
  return contracts;
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

    const { symbol, debug } = body || {};

    if (!symbol) {
      return new Response(
        JSON.stringify({ success: false, error: 'Symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // OPTIMIZED SCRAPING LOGIC WITH PLAYWRIGHT
    // ============================================
    // Step 1: Build the target URL for the futures prices page
    const url = `https://www.barchart.com/futures/quotes/${symbol}%2A/futures-prices`;
    console.log('Scraping prices for symbol:', symbol, 'URL:', url);

    let contracts: any[] = [];
    
    // Step 2: Try Playwright first, fallback to fetch if it fails
    try {
      // Use optimized scraping utility with resource blocking and retry logic
      // This handles browser reuse, concurrency limiting, and automatic retries
      contracts = await scrapeWithPlaywright(
      url,
      async (page: Page, jsonResponses: Map<string, any>) => {
        console.log('Page loaded, extracting HTML content...');
        
        // Try to extract data from JSON responses first (if available)
        let contractsFromJson: any[] = [];
        for (const [responseUrl, jsonData] of jsonResponses.entries()) {
          console.log(`Found JSON response: ${responseUrl}`);
          // Try to extract contracts from JSON if the structure matches
          if (Array.isArray(jsonData)) {
            contractsFromJson = jsonData;
          } else if (jsonData?.data && Array.isArray(jsonData.data)) {
            contractsFromJson = jsonData.data;
          } else if (jsonData?.contracts && Array.isArray(jsonData.contracts)) {
            contractsFromJson = jsonData.contracts;
          }
        }
        
        // Step 3: Extract HTML content from the fully loaded page
        const html = await page.content();
        
        // Step 4: Parse HTML table to extract contract data
        // This uses the existing parseHtmlTable function to extract structured data
        let contracts = parseHtmlTable(html, symbol);
        console.log(`Found ${contracts.length} contracts in HTML`);
        
        // Step 5: Also try markdown parsing as a fallback method
        const markdownContracts = parseMarkdownTable(html, symbol);
        console.log(`Found ${markdownContracts.length} contracts via markdown parsing`);
        
        // Step 6: Merge contracts from all sources (JSON, HTML, markdown)
        const allContractsMap = new Map<string, any>();
        
        // Add contracts from JSON if available
        contractsFromJson.forEach((c: any) => {
          if (c.contract) {
            allContractsMap.set(c.contract.toUpperCase(), c);
          }
        });
        
        // Add contracts from HTML parsing
        contracts.forEach(c => {
          if (c.contract) {
            const contractKey = c.contract.toUpperCase();
            if (allContractsMap.has(contractKey)) {
              const existing = allContractsMap.get(contractKey)!;
              allContractsMap.set(contractKey, {
                ...existing,
                ...c,
                // Prefer non-empty values
                last: c.last || existing.last,
                change: c.change || existing.change,
                high: c.high || existing.high,
                low: c.low || existing.low,
                open: c.open || existing.open,
                volume: c.volume || existing.volume,
                changePercent: c.changePercent || existing.changePercent,
              });
            } else {
              allContractsMap.set(contractKey, c);
            }
          }
        });
        
        // Add contracts from markdown parsing
        markdownContracts.forEach(c => {
          if (c.contract) {
            const contractKey = c.contract.toUpperCase();
            if (allContractsMap.has(contractKey)) {
              const existing = allContractsMap.get(contractKey)!;
              allContractsMap.set(contractKey, {
                ...existing,
                ...c,
                // Prefer non-empty values
                last: c.last || existing.last,
                change: c.change || existing.change,
                high: c.high || existing.high,
                low: c.low || existing.low,
                open: c.open || existing.open,
                volume: c.volume || existing.volume,
                changePercent: c.changePercent || existing.changePercent,
              });
            } else {
              allContractsMap.set(contractKey, c);
            }
          }
        });
        
        // Convert map to array
        const allContracts = Array.from(allContractsMap.values());
        console.log(`Total unique contracts found: ${allContracts.length}`);
        
        return allContracts;
      },
      {
        // Wait for table selector to appear (more reliable than fixed timeout)
        waitForSelector: 'table, [class*="table"], [class*="data-table"]',
        // Intercept JSON API responses that might contain contract data
        interceptJsonUrls: ['api', 'data', 'quotes', 'futures'],
        maxRetries: 3,
      }
      );
    } catch (playwrightError) {
      // Fallback to fetch if Playwright fails (e.g., browser binaries not available)
      const errorMsg = playwrightError instanceof Error ? playwrightError.message : String(playwrightError);
      console.log('Playwright failed, falling back to fetch:', errorMsg);
      
      // Check if it's a browser launch error - in that case, skip Playwright entirely next time
      if (errorMsg.includes('browser launch') || errorMsg.includes('Executable doesn\'t exist') || errorMsg.includes('Browser closed')) {
        console.log('Browser binaries not available, using fetch directly');
      }
      
      try {
        const html = await scrapeWithFetch(url, { timeout: 30000 });
        console.log('Fetch successful, parsing HTML...');
        
        // Parse HTML using existing functions
        contracts = parseHtmlTable(html, symbol);
        console.log(`Found ${contracts.length} contracts via fetch fallback`);
        
        const markdownContracts = parseMarkdownTable(html, symbol);
        console.log(`Found ${markdownContracts.length} contracts via markdown parsing`);
        
        // Merge contracts
        const allContractsMap = new Map<string, any>();
        contracts.forEach(c => {
          if (c.contract) {
            allContractsMap.set(c.contract.toUpperCase(), c);
          }
        });
        markdownContracts.forEach(c => {
          if (c.contract) {
            const contractKey = c.contract.toUpperCase();
            if (allContractsMap.has(contractKey)) {
              const existing = allContractsMap.get(contractKey)!;
              allContractsMap.set(contractKey, {
                ...existing,
                ...c,
                last: c.last || existing.last,
                change: c.change || existing.change,
                high: c.high || existing.high,
                low: c.low || existing.low,
                open: c.open || existing.open,
                volume: c.volume || existing.volume,
                changePercent: c.changePercent || existing.changePercent,
              });
            } else {
              allContractsMap.set(contractKey, c);
            }
          }
        });
        contracts = Array.from(allContractsMap.values());
        console.log(`Total contracts after merge: ${contracts.length}`);
      } catch (fetchError) {
        console.error('Fetch fallback also failed:', fetchError);
        // Instead of throwing, return empty contracts array so the function can still return a valid response
        console.log('Both Playwright and fetch failed, returning empty contracts array');
        contracts = [];
      }
    }

    // Map to our format and filter valid contracts
    const futuresData: FuturesData[] = contracts
      .filter((c: { contract?: string; last?: string }) => {
        if (!c.contract) return false;
        // Validate contract format - allow any month code and year
        const contractRegex = new RegExp(`^${symbol}[${MONTH_CODES}]\\d{2}$`, 'i');
        return contractRegex.test(c.contract);
      })
      .map((c: any) => ({
        contract: c.contract.toUpperCase(),
        latest: c.last || c.latest || 'N/A', // Include contracts even without price
        change: c.change || undefined,
        high: c.high || undefined,
        low: c.low || undefined,
        open: c.open || undefined,
        volume: c.volume || undefined,
        changePercent: c.changePercent || undefined,
      }));

    // If no contracts found, return empty array with success=true instead of error
    if (futuresData.length === 0) {
      console.log(`No contracts found for ${symbol}, returning empty array`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          symbol,
          data: [],
          count: 0,
          message: 'No contracts found. The page structure may have changed or the symbol may not be available.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduplicate
    const seen = new Set<string>();
    const dedupedData = futuresData.filter((item: FuturesData) => {
      if (seen.has(item.contract)) return false;
      seen.add(item.contract);
      return true;
    });

    // Sort contracts by expiration date
    dedupedData.sort((a: FuturesData, b: FuturesData) => {
      const aCode = a.contract.slice(-3);
      const bCode = b.contract.slice(-3);
      
      const aYear = parseInt(aCode.slice(-2));
      const bYear = parseInt(bCode.slice(-2));
      
      if (aYear !== bYear) return aYear - bYear;
      
      const aMonth = MONTH_CODES.indexOf(aCode[0]);
      const bMonth = MONTH_CODES.indexOf(bCode[0]);
      
      return aMonth - bMonth;
    });

    console.log(`Final extracted ${dedupedData.length} futures prices for ${symbol}`);

    const responsePayload: Record<string, unknown> = { 
      success: true, 
      symbol,
      data: dedupedData,
      count: dedupedData.length,
    };

    if (debug) {
      responsePayload.debug = {
        rawContracts: contracts,
      };
    }

    return new Response(
      JSON.stringify(responsePayload),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping prices:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape prices';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Force this file to be treated as an ES module
export {};
