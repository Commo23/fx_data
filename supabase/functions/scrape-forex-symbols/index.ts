const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping forex symbols from Barchart...');

    // Scrape the currencies futures page
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://www.barchart.com/futures/currencies',
        formats: ['markdown', 'html'],
        onlyMainContent: true,
        waitFor: 3000,
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

    // Extract symbols from the scraped content
    const markdown = data.data?.markdown || data.markdown || '';
    const html = data.data?.html || data.html || '';
    
    console.log('Scraped content length:', markdown.length);

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
