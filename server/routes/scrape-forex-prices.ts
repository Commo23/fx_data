import { Request, Response } from 'express';
import { scrapeWithPlaywright, type Page } from '../playwright-utils';

const MONTH_CODES = 'FGHJKMNQUVXZ';

// Helper function to parse HTML table (improved)
function parseHtmlTable(html: string, symbol: string): any[] {
  const contracts: any[] = [];
  const contractPattern = new RegExp(`(${symbol}[${MONTH_CODES}]\\d{2})`, 'gi');
  
  // Strategy 1: Parse table rows
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = [...html.matchAll(rowPattern)];
  
  let headerFound = false;
  let headerIndexes: Record<string, number> = {};
  
  for (const rowMatch of rows) {
    const rowHtml = rowMatch[1];
    const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells = [...rowHtml.matchAll(cellPattern)].map(match => {
      return match[1].replace(/<[^>]+>/g, '').trim();
    }).filter(cell => cell.length > 0);
    
    if (cells.length === 0) continue;
    
    if (!headerFound && cells.some(cell => {
      const lower = cell.toLowerCase();
      return lower.includes('contract') || lower.includes('symbol') || 
             lower.includes('last') || lower.includes('price') || 
             lower.includes('change') || lower.includes('volume');
    })) {
      headerFound = true;
      cells.forEach((cell, idx) => {
        const lower = cell.toLowerCase();
        if (lower.includes('contract') || lower.includes('symbol')) headerIndexes.contract = idx;
        if (lower.includes('last') || lower.includes('latest') || lower.includes('price')) headerIndexes.latest = idx;
        if (lower.includes('change')) headerIndexes.change = idx;
        if (lower.includes('high')) headerIndexes.high = idx;
        if (lower.includes('low')) headerIndexes.low = idx;
        if (lower.includes('open')) headerIndexes.open = idx;
        if (lower.includes('volume')) headerIndexes.volume = idx;
      });
      continue;
    }
    
    if (headerFound && cells.length >= 2) {
      const contract = cells[headerIndexes.contract] || cells[0];
      const latest = cells[headerIndexes.latest] || cells[1];
      const change = cells[headerIndexes.change] || cells[2];
      const high = cells[headerIndexes.high] || cells[3];
      const low = cells[headerIndexes.low] || cells[4];
      const open = cells[headerIndexes.open] || cells[5];
      const volume = cells[headerIndexes.volume] || cells[6];
      
      if (contract && contractPattern.test(contract)) {
        contracts.push({
          contract: contract.trim().toUpperCase(),
          latest: latest?.trim() || undefined,
          change: change?.trim() || undefined,
          high: high?.trim() || undefined,
          low: low?.trim() || undefined,
          open: open?.trim() || undefined,
          volume: volume?.trim() || undefined,
        });
      }
    }
  }
  
  // Strategy 2: If no contracts found in tables, search in entire HTML
  if (contracts.length === 0) {
    const matches = [...html.matchAll(contractPattern)];
    const foundContracts = new Set<string>();
    
    for (const match of matches) {
      const contractSymbol = match[1].toUpperCase();
      if (foundContracts.has(contractSymbol)) continue;
      foundContracts.add(contractSymbol);
      
      // Try to find prices near the contract in HTML
      const matchIndex = match.index || 0;
      const context = html.substring(
        Math.max(0, matchIndex - 500),
        Math.min(html.length, matchIndex + 1000)
      );
      
      // Look for price patterns
      const pricePattern = /([+-]?\d+\.\d+)/g;
      const prices = [...context.matchAll(pricePattern)];
      
      if (prices.length > 0) {
        const afterContract = context.substring(context.indexOf(match[1]) + match[1].length);
        const afterPrices = [...afterContract.matchAll(pricePattern)];
        
        if (afterPrices.length > 0) {
          contracts.push({
            contract: contractSymbol,
            latest: afterPrices[0][1],
            change: afterPrices[1]?.[1] || undefined,
            high: afterPrices[2]?.[1] || undefined,
            low: afterPrices[3]?.[1] || undefined,
          });
        }
      }
    }
  }
  
  return contracts;
}

export async function scrapeForexPrices(req: Request, res: Response) {
  try {
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ 
        success: false, 
        error: 'Symbol is required' 
      });
    }

    // Build URL for futures prices page
    // Format: https://www.barchart.com/futures/quotes/{SYMBOL}*/futures-prices
    // Example: https://www.barchart.com/futures/quotes/DX*/futures-prices (all DX contracts)
    // Example: https://www.barchart.com/futures/quotes/DXH26/futures-prices (specific contract)
    // We use %2A (*) to get all contracts for the symbol
    const url = `https://www.barchart.com/futures/quotes/${symbol}%2A/futures-prices`;
    console.log('Scraping prices for symbol:', symbol, 'URL:', url);

    let contracts: any[] = [];
    
    try {
      contracts = await scrapeWithPlaywright(
        url,
        async (page: Page, jsonResponses: Map<string, any>) => {
          console.log('Page loaded, waiting for content...');
          
          // Wait for Barchart API response for futures
          // API format: .../quotes/get?lists=futures.contractInRoot&root={SYMBOL}...
          // Accept any quotes/get response (the list parameter might be in query string)
          try {
            await page.waitForResponse(
              (response) => {
                const url = response.url();
                return url.includes('barchart.com') && url.includes('quotes/get');
              },
              { timeout: 15000 }
            );
            console.log('Barchart API response received (quotes/get)');
            await page.waitForTimeout(2000); // Give time for JSON to be intercepted
          } catch (e) {
            console.log('No Barchart API response detected, waiting for table content...');
            // For futures, data might be loaded directly in HTML, so wait for table
            // Try multiple strategies to wait for content
            let contentLoaded = false;
            
            // Strategy 1: Wait for table rows
            try {
              await page.waitForSelector('table tbody tr, table tr', { timeout: 5000 });
              console.log('Table rows found');
              contentLoaded = true;
            } catch (e2) {
              // Continue to next strategy
            }
            
            // Strategy 2: Wait for contract symbols in body text
            if (!contentLoaded) {
              for (let i = 0; i < 10; i++) {
                const hasContent = await page.evaluate((sym) => {
                  const bodyText = document.body.innerText || '';
                  const contractPattern = new RegExp(`${sym}[FGHJKMNQUVXZ]\\d{2}`, 'i');
                  return contractPattern.test(bodyText);
                }, symbol);
                
                if (hasContent) {
                  console.log(`Contract symbols found in body text after ${i + 1} attempts`);
                  contentLoaded = true;
                  break;
                }
                
                await page.waitForTimeout(1000);
              }
            }
            
            // Strategy 3: Wait for networkidle
            if (!contentLoaded) {
              try {
                await page.waitForLoadState('networkidle', { timeout: 5000 });
                console.log('Network idle');
              } catch (e3) {
                // Continue
              }
            }
            
            // Final wait to ensure content is rendered
            await page.waitForTimeout(2000);
          }
          
          console.log('Extracting HTML content...');
          
          // Extract contracts from JSON responses first (same logic as options)
          let contractsFromJson: any[] = [];
          console.log(`Total JSON responses intercepted: ${jsonResponses.size}`);
          for (const [responseUrl, jsonData] of jsonResponses.entries()) {
            console.log(`Checking JSON response: ${responseUrl.substring(0, 150)}...`);
            
            // Check if this is a Barchart API response for futures
            // URL format: .../quotes/get?lists=futures.contractInRoot&root={SYMBOL}...
            // Also accept any quotes/get response (the list parameter might be in query string)
            if (responseUrl.includes('barchart.com') && responseUrl.includes('quotes/get')) {
              console.log('Found Barchart API response (quotes/get), checking for futures data...');
              console.log('Response URL:', responseUrl.substring(0, 200));
              console.log('JSON data structure:', JSON.stringify(jsonData).substring(0, 1000));
              
              // Barchart API structure for futures: 
              // { data: { list: { "futures.contractInRoot": [...] } } }
              // OR: { data: { [symbol]: { list: { "futures.contractInRoot": [...] } } } }
              if (jsonData?.data) {
                // Strategy 1: Check if data has a list property directly (most common)
                if (jsonData.data.list && typeof jsonData.data.list === 'object') {
                  for (const listKey of Object.keys(jsonData.data.list)) {
                    const listData = jsonData.data.list[listKey];
                    if (Array.isArray(listData)) {
                      console.log(`Found ${listData.length} contracts in list: ${listKey}`);
                      contractsFromJson = listData;
                      break;
                    }
                  }
                }
                
                // Strategy 2: Check each symbol in data
                if (contractsFromJson.length === 0) {
                  for (const symbolKey of Object.keys(jsonData.data)) {
                    const symbolData = jsonData.data[symbolKey];
                    if (symbolData && typeof symbolData === 'object') {
                      // Check for list property (futures.contractInRoot)
                      if (symbolData.list && typeof symbolData.list === 'object') {
                        for (const listKey of Object.keys(symbolData.list)) {
                          const listData = symbolData.list[listKey];
                          if (Array.isArray(listData)) {
                            console.log(`Found ${listData.length} contracts in list: ${listKey} for symbol ${symbolKey}`);
                            contractsFromJson = listData;
                            break;
                          }
                        }
                        if (contractsFromJson.length > 0) break;
                      }
                      // Also check if symbolData is an array
                      if (Array.isArray(symbolData)) {
                        contractsFromJson = symbolData;
                        break;
                      }
                    }
                  }
                }
              }
              
              // Also try direct array or data array
              if (contractsFromJson.length === 0) {
                if (Array.isArray(jsonData)) {
                  contractsFromJson = jsonData;
                } else if (jsonData?.data && Array.isArray(jsonData.data)) {
                  contractsFromJson = jsonData.data;
                } else if (jsonData?.contracts && Array.isArray(jsonData.contracts)) {
                  contractsFromJson = jsonData.contracts;
                }
              }
              
              if (contractsFromJson.length > 0) {
                console.log(`Extracted ${contractsFromJson.length} contracts from Barchart API`);
                // Transform Barchart API format to our format
                // Fields: symbol, contractSymbol, lastPrice, priceChange, openPrice, highPrice, lowPrice, previousPrice, volume, openInterest
                contractsFromJson = contractsFromJson.map((c: any) => ({
                  contract: String(c.symbol || c.contractSymbol || c.contract || '').toUpperCase(),
                  latest: String(c.lastPrice || c.last || c.price || ''),
                  change: String(c.priceChange || c.change || c.netChange || ''),
                  high: String(c.highPrice || c.high || ''),
                  low: String(c.lowPrice || c.low || ''),
                  open: String(c.openPrice || c.open || ''),
                  volume: String(c.volume || ''),
                  openInterest: String(c.openInterest || ''),
                  previous: String(c.previousPrice || c.previous || ''),
                })).filter((c: any) => {
                  // Filter to only contracts matching our symbol pattern
                  if (!c.contract) return false;
                  const contractUpper = c.contract.toUpperCase();
                  const symbolUpper = symbol.toUpperCase();
                  // Match contracts like DXH26, DXM26, etc. or cash contract like DX00
                  return contractUpper.match(new RegExp(`${symbolUpper}[${MONTH_CODES}]\\d{2}`, 'i')) || 
                         contractUpper === symbolUpper + '00' || // Cash contract
                         contractUpper.startsWith(symbolUpper); // Also accept contracts starting with symbol
                });
                console.log(`After transformation: ${contractsFromJson.length} valid contracts`);
                if (contractsFromJson.length > 0) {
                  console.log('Sample contracts:', contractsFromJson.slice(0, 3).map(c => c.contract));
                  break; // Found contracts, no need to check other responses
                } else {
                  console.log('No contracts matched the symbol pattern after transformation');
                }
              } else {
                console.log('No contracts found in this JSON response structure');
                // Log the structure for debugging
                console.log('JSON keys:', Object.keys(jsonData || {}));
                if (jsonData?.data) {
                  console.log('data keys:', Object.keys(jsonData.data));
                }
              }
            } else {
              // Generic JSON parsing for non-Barchart APIs
              console.log('Non-Barchart API response, trying generic parsing...');
              if (Array.isArray(jsonData)) {
                contractsFromJson = jsonData;
                console.log(`Found ${jsonData.length} items in array`);
              } else if (jsonData?.data && Array.isArray(jsonData.data)) {
                contractsFromJson = jsonData.data;
                console.log(`Found ${jsonData.data.length} items in data array`);
              } else if (jsonData?.contracts && Array.isArray(jsonData.contracts)) {
                contractsFromJson = jsonData.contracts;
                console.log(`Found ${jsonData.contracts.length} items in contracts array`);
              } else {
                console.log('No recognizable array structure in JSON response');
              }
            }
          }
          
          console.log(`Total contracts extracted from JSON: ${contractsFromJson.length}`);
          
          // Extract directly from DOM (most reliable for futures)
          console.log('Extracting contracts directly from DOM...');
          const domContracts = await page.evaluate((sym) => {
            const contracts: any[] = [];
            const monthCodes = 'FGHJKMNQUVXZ';
            const contractPattern = new RegExp(`(${sym}[${monthCodes}]\\d{2})`, 'gi');
            
            // Find all table rows
            const allRows = Array.from(document.querySelectorAll('table tbody tr, table tr, [class*="table"] tr'));
            console.log(`Found ${allRows.length} table rows in DOM`);
            
            for (const row of allRows) {
              const cells = Array.from(row.querySelectorAll('td, th'));
              if (cells.length < 2) continue;
              
              const rowText = row.textContent || '';
              
              // Look for contract symbol in the row
              const contractMatch = rowText.match(contractPattern);
              if (!contractMatch) continue;
              
              const contractSymbol = contractMatch[1].toUpperCase();
              
              // Extract data from cells
              const cellTexts = cells.map(cell => (cell.textContent || '').trim().replace(/\s+/g, ' '));
              
              // Find Latest, Change, High, Low, Open, Volume, etc.
              let latest = '';
              let change = '';
              let high = '';
              let low = '';
              let open = '';
              let volume = '';
              
              // Try to find prices in the row
              for (let i = 0; i < cellTexts.length; i++) {
                const text = cellTexts[i];
                
                // Latest price (usually first number after contract, may have 's' suffix)
                if (!latest && /^\d+\.\d+/.test(text)) {
                  latest = text.replace(/[sS]$/, '').trim();
                }
                
                // Change (usually has + or -)
                if (!change && /^[+-]\d+\.\d+/.test(text)) {
                  change = text.trim();
                }
                
                // High, Low, Open (numbers with decimals)
                if (/^\d+\.\d+$/.test(text)) {
                  if (!high) high = text;
                  else if (!low) low = text;
                  else if (!open) open = text;
                }
                
                // Volume (numbers with commas)
                if (/^\d{1,3}(?:,\d{3})+$/.test(text)) {
                  volume = text;
                }
              }
              
              if (contractSymbol && latest) {
                contracts.push({
                  contract: contractSymbol,
                  latest: latest,
                  change: change || undefined,
                  high: high || undefined,
                  low: low || undefined,
                  open: open || undefined,
                  volume: volume || undefined,
                });
              }
            }
            
            return contracts;
          }, symbol);
          
          console.log(`Extracted ${domContracts.length} contracts directly from DOM`);
          
          const html = await page.content();
          const htmlContracts = parseHtmlTable(html, symbol);
          console.log(`Found ${htmlContracts.length} contracts in HTML`);
          
          // Prioritize DOM extraction, then JSON, then HTML
          let finalContracts: any[] = [];
          
          if (domContracts.length > 0) {
            finalContracts = domContracts;
            console.log(`Using ${domContracts.length} contracts from DOM`);
          } else if (contractsFromJson.length > 0) {
            finalContracts = contractsFromJson;
            console.log(`Using ${contractsFromJson.length} contracts from JSON`);
          } else if (htmlContracts.length > 0) {
            finalContracts = htmlContracts;
            console.log(`Using ${htmlContracts.length} contracts from HTML`);
          }
          
          return finalContracts;
        },
        {
          waitForSelector: 'table, [class*="table"], [class*="futures"], [class*="prices"], body',
          interceptJsonUrls: ['api', 'data', 'contracts', 'futures', 'quotes', 'barchart', 'proxies', 'core-api', 'quotes/get', 'contractInRoot'],
          maxRetries: 3,
        }
      );
    } catch (playwrightError) {
      console.error('Playwright scraping failed:', playwrightError);
      contracts = [];
    }

    console.log(`Total contracts found: ${contracts.length}`);

    res.json({
      success: true,
      symbol,
      data: contracts,
      count: contracts.length,
      message: contracts.length === 0 
        ? 'Aucun contrat trouvé pour ce symbole. Les données peuvent être en cours de chargement ou non disponibles.'
        : undefined,
    });
  } catch (error) {
    console.error('Error scraping futures prices:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape futures prices';
    res.status(500).json({ success: false, error: errorMessage });
  }
}
