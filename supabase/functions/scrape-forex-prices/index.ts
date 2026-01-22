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
          if (lower.includes('last')) headerIndexes.last = idx;
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
        
        // Check if contract matches our symbol pattern
        if (contractCell && contractCell.match(new RegExp(`^${symbol}[${MONTH_CODES}]\\d{2}$`, 'i'))) {
          contracts.push({
            contract: contractCell.toUpperCase(),
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

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      const errorMsg = 'Firecrawl API key not configured. Please add FIRECRAWL_API_KEY as a secret in Supabase Edge Functions settings.';
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('FIRECRAWL_API_KEY found, length:', apiKey.length);

    // Use the futures prices page
    const url = `https://www.barchart.com/futures/quotes/${symbol}%2A/futures-prices`;
    console.log('Scraping prices for symbol:', symbol, 'URL:', url);

    // Use extract format with a comprehensive prompt to get ALL structured data via LLM
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['extract', 'markdown', 'html'],
        extract: {
          prompt: `Extract ALL futures contract data from this page. This page shows a table of futures contracts for ${symbol}.

For EACH row in the futures prices table, extract ALL available data:
- contract: The full contract symbol (e.g., DXH26, DXM26, DXU26, DXZ26, 6EH26, 6EM26, 6EU26, 6EZ26, etc.)
- last: The last/latest price
- change: The price change (can be positive like +0.145 or negative like -0.120)
- high: The high price for the day (if available)
- low: The low price for the day (if available)
- open: The opening price (if available)
- volume: The trading volume (if available)
- changePercent: The percentage change (if available)

IMPORTANT: Extract ALL contracts visible on the page, not just a few. Look for the complete table with all contract months and years.
Include contracts for all expiration months (H, M, U, Z for March, June, September, December, plus others if shown).

Return ALL contracts that match the pattern ${symbol}[LETTER][YEAR] (e.g., ${symbol}H26, ${symbol}M26, ${symbol}U26, ${symbol}Z26, ${symbol}H27, etc.).

Format the response as a JSON object with a contracts array containing all extracted contracts.`,
          schema: {
            type: 'object',
            properties: {
              contracts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    contract: { type: 'string', description: 'Contract symbol like DXH26, 6EH26' },
                    last: { type: 'string', description: 'Last/latest price' },
                    change: { type: 'string', description: 'Price change' },
                    high: { type: 'string', description: 'High price' },
                    low: { type: 'string', description: 'Low price' },
                    open: { type: 'string', description: 'Opening price' },
                    volume: { type: 'string', description: 'Trading volume' },
                    changePercent: { type: 'string', description: 'Percentage change' }
                  },
                  required: ['contract', 'last']
                }
              }
            },
            required: ['contracts']
          }
        },
        waitFor: 12000, // Increased wait time for page to fully load
        timeout: 60000, // 60 second timeout
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Firecrawl response received');
    
    // Extract the data from LLM extraction
    const extractedData = data.data?.extract || data.extract || {};
    let contracts = extractedData.contracts || [];
    
    console.log(`Extracted ${contracts.length} contracts via LLM extraction`);

    // Also try to extract from markdown/HTML as fallback
    const markdown = data.data?.markdown || data.markdown || '';
    const html = data.data?.html || data.html || '';
    
    // If LLM extraction returned few contracts, try parsing markdown/HTML
    if (contracts.length < 5 && (markdown.length > 0 || html.length > 0)) {
      console.log('LLM extraction returned few contracts, trying markdown/HTML parsing...');
      
      // Parse markdown table
      const markdownContracts = parseMarkdownTable(markdown, symbol);
      if (markdownContracts.length > contracts.length) {
        console.log(`Found ${markdownContracts.length} contracts in markdown`);
        contracts = markdownContracts;
      }
    }

    // Map to our format and filter valid contracts
    const futuresData: FuturesData[] = contracts
      .filter((c: { contract?: string; last?: string }) => {
        if (!c.contract || !c.last) return false;
        // Validate contract format - allow any month code and year
        const contractRegex = new RegExp(`^${symbol}[${MONTH_CODES}]\\d{2}$`, 'i');
        return contractRegex.test(c.contract);
      })
      .map((c: any) => ({
        contract: c.contract.toUpperCase(),
        latest: c.last || c.latest,
        change: c.change || undefined,
        high: c.high || undefined,
        low: c.low || undefined,
        open: c.open || undefined,
        volume: c.volume || undefined,
        changePercent: c.changePercent || undefined,
      }));

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
        extractedData,
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
