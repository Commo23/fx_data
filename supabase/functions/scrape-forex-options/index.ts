// Deno types for Supabase Edge Functions
declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

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

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      const errorMsg = 'Firecrawl API key not configured. Please add FIRECRAWL_API_KEY as a secret in Supabase Edge Functions settings.';
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the options contract symbol
    const contractSymbol = buildOptionsContractSymbol(baseSymbol, monthCode, year);
    console.log('Options contract symbol:', contractSymbol);

    // Use the volatility-greeks page which shows options data
    // URL format: https://www.barchart.com/futures/quotes/E6H26/volatility-greeks?futuresOptionsView=merged&moneyness=allRows
    const url = `https://www.barchart.com/futures/quotes/${contractSymbol}/volatility-greeks?futuresOptionsView=merged&moneyness=allRows`;
    console.log('Scraping options for:', contractSymbol, 'URL:', url);

    // Try markdown/html first for faster response, then extract if needed
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html'], // Start with markdown/html for faster response
        onlyMainContent: true,
        waitFor: 8000, // Reduced from 12s to 8s
        timeout: 45000, // Reduced from 60s to 45s
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
    
    // Parse markdown/HTML directly (faster than LLM extraction)
    const markdown = data.data?.markdown || data.markdown || '';
    const html = data.data?.html || data.html || '';
    
    console.log(`Markdown length: ${markdown.length}, HTML length: ${html.length}`);
    
    // Parse options from markdown first (fastest)
    let options = parseMarkdownOptionsTable(markdown);
    console.log(`Found ${options.length} options in markdown`);
    
    // If markdown parsing didn't find enough, try HTML parsing
    if (options.length < 5 && html.length > 0) {
      console.log('Trying HTML parsing as fallback...');
      const htmlOptions = parseHtmlOptionsTable(html);
      if (htmlOptions.length > options.length) {
        console.log(`Found ${htmlOptions.length} options in HTML`);
        options = htmlOptions;
      }
    }
    
    // If still no options, try LLM extraction as last resort
    if (options.length < 5) {
      console.log('Trying LLM extraction as last resort...');
      try {
        const extractResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url,
            formats: ['extract'],
            extract: {
              prompt: `Extract options data from this page. For each row, extract: strike (price), type (C for Call, P for Put), latest (price), iv (volatility). Return as JSON with options array.`,
              schema: {
                type: 'object',
                properties: {
                  options: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        strike: { type: 'string' },
                        type: { type: 'string' },
                        latest: { type: 'string' },
                        iv: { type: 'string' }
                      },
                      required: ['strike', 'type', 'latest', 'iv']
                    }
                  }
                },
                required: ['options']
              }
            },
            waitFor: 6000,
            timeout: 30000,
          }),
        });
        
        const extractData = await extractResponse.json();
        if (extractResponse.ok) {
          const extractedOptions = extractData.data?.extract?.options || extractData.extract?.options || [];
          if (extractedOptions.length > options.length) {
            console.log(`Found ${extractedOptions.length} options via LLM extraction`);
            options = extractedOptions;
          }
        }
      } catch (extractError) {
        console.error('LLM extraction failed, using markdown results:', extractError);
      }
    }

    // Map and filter valid options
    const optionsData: OptionData[] = options
      .filter((opt: any) => {
        return opt.strike && opt.type && opt.latest && opt.iv;
      })
      .map((opt: any) => ({
        strike: String(opt.strike).trim(),
        type: (String(opt.type).toUpperCase().startsWith('C') ? 'C' : 'P') as 'C' | 'P',
        latest: String(opt.latest).trim(),
        iv: String(opt.iv).trim(),
      }));

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

    return new Response(
      JSON.stringify({
        success: true,
        baseSymbol,
        contractSymbol,
        maturity: { monthCode, year },
        data: dedupedOptions,
        count: dedupedOptions.length,
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
        
        // Validate we have required fields
        if (strike && latest && iv) {
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
      
      // Validate we have required fields
      if (strike && latest && iv) {
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

