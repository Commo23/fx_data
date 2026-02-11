import { Request, Response } from 'express';
import { scrapeWithPlaywright, type Page } from '../playwright-utils';

interface OptionData {
  strike: string;
  type: 'C' | 'P';
  latest: string;
  iv: string;
}

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

// Validate that options data contains actual numeric values
function isValidOptionsData(options: any[]): boolean {
  if (!options || options.length === 0) return false;
  
  const validOptions = options.filter(opt => {
    if (!opt.strike || !opt.latest || !opt.iv) return false;
    
    const strikeNum = parseFloat(String(opt.strike).replace(/[^0-9.-]/g, ''));
    if (isNaN(strikeNum) || strikeNum <= 0) return false;
    
    const latestNum = parseFloat(String(opt.latest).replace(/[^0-9.-]/g, ''));
    if (isNaN(latestNum)) return false;
    
    const ivStr = String(opt.iv).replace(/%/g, '');
    const ivNum = parseFloat(ivStr.replace(/[^0-9.-]/g, ''));
    if (isNaN(ivNum) || ivNum < 0) return false;
    
    const type = String(opt.type).toUpperCase().trim();
    if (type !== 'C' && type !== 'P') return false;
    
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

// Helper function to parse a single options table section
function parseOptionsTableSection(htmlSection: string, defaultType: 'C' | 'P'): any[] {
  const options: any[] = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = [...htmlSection.matchAll(rowPattern)];
  
  let headerFound = false;
  let headerIndexes: Record<string, number> = {};
  
  for (const rowMatch of rows) {
    const rowHtml = rowMatch[1];
    const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells = [...rowHtml.matchAll(cellPattern)].map(match => {
      return match[1].replace(/<[^>]+>/g, '').trim();
    }).filter(cell => cell.length > 0);
    
    if (cells.length === 0) continue;
    
    // Check if this is a header row
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
      
      if (strike && latest && iv) {
        const strikeNum = parseFloat(String(strike).replace(/[^0-9.-]/g, ''));
        if (isNaN(strikeNum) || strikeNum <= 0) continue;
        
        const latestNum = parseFloat(String(latest).replace(/[^0-9.-]/g, ''));
        if (isNaN(latestNum)) continue;
        
        const ivStr = String(iv).replace(/%/g, '');
        const ivNum = parseFloat(ivStr.replace(/[^0-9.-]/g, ''));
        if (isNaN(ivNum) || ivNum < 0) continue;
        
        const invalidTexts = ['watchlist', 'dashboard', 'login', 'menu', 'navigation', 'retour'];
        const strikeLower = String(strike).toLowerCase();
        const latestLower = String(latest).toLowerCase();
        if (invalidTexts.some(text => strikeLower.includes(text) || latestLower.includes(text))) {
          continue;
        }
        
        // Determine type: use typeCell if available, otherwise use defaultType
        let type: 'C' | 'P' = defaultType;
        if (typeCell) {
          const typeUpper = typeCell.toUpperCase();
          if (typeUpper.includes('CALL') || typeUpper === 'C' || typeUpper.startsWith('C')) {
            type = 'C';
          } else if (typeUpper.includes('PUT') || typeUpper === 'P' || typeUpper.startsWith('P')) {
            type = 'P';
          }
        }
        
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

// Improved parsing function that identifies separate Call and Put tables
function parseHtmlOptionsTable(html: string, optionType?: 'C' | 'P'): any[] {
  const allOptions: any[] = [];
  
  // Strategy 1: Try to find separate table sections for Calls and Puts
  // Look for patterns like "Calls" or "Puts" headings, or table structures separated by ads
  
  // Split HTML by common separators (ads, divs with specific classes, etc.)
  // Look for sections that might contain "Call" or "Put" indicators
  const callPattern = /(?:<[^>]*>.*?(?:call|call options)[^<]*<\/[^>]*>|(?:<h[1-6][^>]*>.*?call.*?<\/h[1-6]>))[\s\S]*?(<table[^>]*>[\s\S]*?<\/table>)/gi;
  const putPattern = /(?:<[^>]*>.*?(?:put|put options)[^<]*<\/[^>]*>|(?:<h[1-6][^>]*>.*?put.*?<\/h[1-6]>))[\s\S]*?(<table[^>]*>[\s\S]*?<\/table>)/gi;
  
  // Try to find tables near "Call" or "Put" text
  const callMatches = [...html.matchAll(callPattern)];
  const putMatches = [...html.matchAll(putPattern)];
  
  // Strategy 2: Find all tables and parse them, determining type from content
  const tablePattern = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const tables = [...html.matchAll(tablePattern)];
  
  let callTableFound = false;
  let putTableFound = false;
  
  for (let i = 0; i < tables.length; i++) {
    const tableHtml = tables[i][1];
    const tableFullHtml = tables[i][0];
    
    // Check if this table is preceded by "Call" or "Put" text
    const beforeTable = html.substring(0, html.indexOf(tableFullHtml));
    const callContext = beforeTable.toLowerCase().includes('call') && !beforeTable.toLowerCase().includes('put');
    const putContext = beforeTable.toLowerCase().includes('put') && !beforeTable.toLowerCase().includes('call');
    
    // Also check table content for type indicators
    const tableContent = tableHtml.toLowerCase();
    const hasCallRows = tableContent.includes('call') || tableContent.match(/type.*?c[^a-z]/i);
    const hasPutRows = tableContent.includes('put') || tableContent.match(/type.*?p[^a-z]/i);
    
    // Determine table type
    let tableType: 'C' | 'P' | null = null;
    if (callContext || (hasCallRows && !hasPutRows)) {
      tableType = 'C';
      callTableFound = true;
    } else if (putContext || (hasPutRows && !hasCallRows)) {
      tableType = 'P';
      putTableFound = true;
    } else if (hasCallRows && hasPutRows) {
      // Mixed table - parse rows individually
      tableType = null; // Will parse each row
    }
    
    // Parse the table
    if (tableType) {
      const options = parseOptionsTableSection(tableFullHtml, tableType);
      allOptions.push(...options);
    } else {
      // Parse without default type, let each row determine its type
      const options = parseOptionsTableSection(tableFullHtml, 'C'); // Default, but will be overridden by row content
      allOptions.push(...options);
    }
  }
  
  // Strategy 3: Fallback - parse entire HTML as single table
  if (allOptions.length === 0) {
    const options = parseOptionsTableSection(html, 'C');
    allOptions.push(...options);
  }
  
  // Filter by optionType if specified
  if (optionType) {
    return allOptions.filter(opt => opt.type === optionType);
  }
  
  return allOptions;
}

export async function scrapeForexOptions(req: Request, res: Response) {
  try {
    const { baseSymbol, monthCode, year, optionType } = req.body;

    if (!baseSymbol || !monthCode || !year) {
      return res.status(400).json({ 
        success: false, 
        error: 'baseSymbol, monthCode, and year are required' 
      });
    }
    
    // Validate optionType if provided
    const validOptionType = optionType && (optionType === 'C' || optionType === 'P') ? optionType : undefined;

    const contractSymbol = buildOptionsContractSymbol(baseSymbol, monthCode, year);
    console.log('Options contract symbol:', contractSymbol);

    const url = `https://www.barchart.com/futures/quotes/${contractSymbol}/volatility-greeks?futuresOptionsView=merged&moneyness=allRows`;
    console.log('Scraping options for:', contractSymbol, 'URL:', url);

    let options: any[] = [];
    
    try {
      options = await scrapeWithPlaywright(
        url,
        async (page: Page, jsonResponses: Map<string, any>) => {
          console.log('Page loaded, extracting HTML content...');
          
          // Strategy: Use Playwright to directly extract Call and Put tables from DOM
          let optionsFromDom: any[] = [];
          try {
            // Wait for tables to be visible
            await page.waitForSelector('table', { timeout: 10000 }).catch(() => {});
            
            // Extract options from DOM by finding tables and their context
            optionsFromDom = await page.evaluate((targetType) => {
              const options: any[] = [];
              
              // Find all tables
              const tables = Array.from(document.querySelectorAll('table'));
              
              for (const table of tables) {
                // Check context before table (look for "Call" or "Put" text)
                let tableType: 'C' | 'P' | null = null;
                let element: Element | null = table.previousElementSibling;
                let checkCount = 0;
                
                // Check previous siblings for "Call" or "Put" indicators
                while (element && checkCount < 10) {
                  const text = element.textContent?.toLowerCase() || '';
                  if (text.includes('call') && !text.includes('put')) {
                    tableType = 'C';
                    break;
                  } else if (text.includes('put') && !text.includes('call')) {
                    tableType = 'P';
                    break;
                  }
                  element = element.previousElementSibling;
                  checkCount++;
                }
                
                // Also check parent elements
                if (!tableType) {
                  let parent: Element | null = table.parentElement;
                  checkCount = 0;
                  while (parent && checkCount < 5) {
                    const text = parent.textContent?.toLowerCase() || '';
                    if (text.includes('call') && !text.includes('put')) {
                      tableType = 'C';
                      break;
                    } else if (text.includes('put') && !text.includes('call')) {
                      tableType = 'P';
                      break;
                    }
                    parent = parent.parentElement;
                    checkCount++;
                  }
                }
                
                // Parse table rows
                const rows = Array.from(table.querySelectorAll('tr'));
                let headerFound = false;
                let headerIndexes: Record<string, number> = {};
                
                for (const row of rows) {
                  const cells = Array.from(row.querySelectorAll('th, td')).map(cell => 
                    cell.textContent?.trim() || ''
                  ).filter(cell => cell.length > 0);
                  
                  if (cells.length === 0) continue;
                  
                  // Check if header row
                  if (!headerFound && cells.some(cell => {
                    const lower = cell.toLowerCase();
                    return lower.includes('strike') || lower.includes('type') || 
                           lower.includes('last') || lower.includes('iv');
                  })) {
                    headerFound = true;
                    cells.forEach((cell, idx) => {
                      const lower = cell.toLowerCase();
                      if (lower.includes('strike')) headerIndexes.strike = idx;
                      if (lower.includes('type')) headerIndexes.type = idx;
                      if (lower.includes('last') || lower.includes('latest')) headerIndexes.latest = idx;
                      if (lower.includes('iv')) headerIndexes.iv = idx;
                    });
                    continue;
                  }
                  
                  // Parse data rows
                  if (headerFound && cells.length >= 3) {
                    const strike = cells[headerIndexes.strike] || cells[0];
                    const typeCell = cells[headerIndexes.type] || cells[1];
                    const latest = cells[headerIndexes.latest] || cells[2];
                    const iv = cells[headerIndexes.iv] || cells[3];
                    
                    if (strike && latest && iv) {
                      // Determine type
                      let type: 'C' | 'P' = tableType || 'C';
                      if (typeCell) {
                        const typeUpper = typeCell.toUpperCase();
                        if (typeUpper.includes('CALL') || typeUpper === 'C' || typeUpper.startsWith('C')) {
                          type = 'C';
                        } else if (typeUpper.includes('PUT') || typeUpper === 'P' || typeUpper.startsWith('P')) {
                          type = 'P';
                        }
                      }
                      
                      // Filter by targetType if specified
                      if (targetType && type !== targetType) continue;
                      
                      options.push({ strike, type, latest, iv });
                    }
                  }
                }
              }
              
              return options;
            }, validOptionType);
            
            console.log(`Extracted ${optionsFromDom.length} options from DOM${validOptionType ? ` (type: ${validOptionType})` : ''}`);
          } catch (domError) {
            console.error('DOM extraction failed:', domError);
          }
          
          let optionsFromJson: any[] = [];
          for (const [responseUrl, jsonData] of jsonResponses.entries()) {
            console.log(`Found JSON response: ${responseUrl}`);
            
            // Check if this is a Barchart API response
            if (responseUrl.includes('barchart.com') && responseUrl.includes('quotes/get')) {
              console.log('Found Barchart API response, extracting options...');
              console.log('JSON data structure:', JSON.stringify(jsonData).substring(0, 500));
              
              // Barchart API structure: { data: { [symbol]: { list: { [listName]: [...] } } } }
              if (jsonData?.data) {
                for (const symbolKey of Object.keys(jsonData.data)) {
                  const symbolData = jsonData.data[symbolKey];
                  if (symbolData && typeof symbolData === 'object') {
                    // Check for list property
                    if (symbolData.list && typeof symbolData.list === 'object') {
                      for (const listKey of Object.keys(symbolData.list)) {
                        const listData = symbolData.list[listKey];
                        if (Array.isArray(listData)) {
                          console.log(`Found ${listData.length} options in list: ${listKey}`);
                          optionsFromJson = listData;
                          break;
                        }
                      }
                    }
                    // Also check direct array
                    if (Array.isArray(symbolData)) {
                      optionsFromJson = symbolData;
                    } else if (symbolData.options && Array.isArray(symbolData.options)) {
                      optionsFromJson = symbolData.options;
                    } else if (symbolData.data && Array.isArray(symbolData.data)) {
                      optionsFromJson = symbolData.data;
                    }
                  }
                }
              }
              
              // Also try direct array or data array
              if (optionsFromJson.length === 0) {
                if (Array.isArray(jsonData)) {
                  optionsFromJson = jsonData;
                } else if (jsonData?.data && Array.isArray(jsonData.data)) {
                  optionsFromJson = jsonData.data;
                } else if (jsonData?.options && Array.isArray(jsonData.options)) {
                  optionsFromJson = jsonData.options;
                }
              }
              
              if (optionsFromJson.length > 0) {
                console.log(`Extracted ${optionsFromJson.length} options from Barchart API`);
                // Transform Barchart API format to our format
                optionsFromJson = optionsFromJson.map((opt: any) => ({
                  strike: String(opt.strikePrice || opt.strike || ''),
                  type: (opt.optionType === 'C' || opt.optionType === 'Call' || (opt.optionType && opt.optionType.toUpperCase().includes('CALL'))) ? 'C' : 'P',
                  latest: String(opt.lastPrice || opt.last || opt.price || ''),
                  iv: String(opt.optImpliedVolatility || opt.impliedVolatility || opt.iv || ''),
                })).filter((opt: any) => opt.strike && opt.latest);
                console.log(`After transformation: ${optionsFromJson.length} valid options`);
                break; // Found options, no need to check other responses
              }
            } else {
              // Generic JSON parsing
              if (Array.isArray(jsonData)) {
                optionsFromJson = jsonData;
              } else if (jsonData?.data && Array.isArray(jsonData.data)) {
                optionsFromJson = jsonData.data;
              } else if (jsonData?.options && Array.isArray(jsonData.options)) {
                optionsFromJson = jsonData.options;
              }
            }
          }
          
          const html = await page.content();
          const htmlOptions = parseHtmlOptionsTable(html, validOptionType);
          console.log(`Found ${htmlOptions.length} options in HTML${validOptionType ? ` (filtered by type: ${validOptionType})` : ''}`);
          
          let finalOptions: any[] = [];
          
          // Priority: DOM extraction > JSON > HTML parsing
          if (optionsFromDom.length > 0 && isValidOptionsData(optionsFromDom)) {
            finalOptions = optionsFromDom;
            console.log(`Using ${optionsFromDom.length} options from DOM extraction`);
          } else if (optionsFromJson.length > 0 && isValidOptionsData(optionsFromJson)) {
            finalOptions = optionsFromJson;
            console.log(`Using ${optionsFromJson.length} options from JSON`);
          } else if (isValidOptionsData(htmlOptions)) {
            finalOptions = htmlOptions;
            console.log(`Using ${htmlOptions.length} options from HTML parsing`);
          } else if (optionsFromDom.length > 0) {
            finalOptions = optionsFromDom;
            console.log(`Using ${optionsFromDom.length} options from DOM (validation skipped)`);
          } else if (htmlOptions.length > 0) {
            finalOptions = htmlOptions;
            console.log(`Using ${htmlOptions.length} options from HTML (validation skipped)`);
          } else if (optionsFromJson.length > 0) {
            finalOptions = optionsFromJson;
            console.log(`Using ${optionsFromJson.length} options from JSON (validation skipped)`);
          }
          
          return finalOptions;
        },
        {
          waitForSelector: 'table, [class*="table"], [class*="options"], [class*="strike"]',
          interceptJsonUrls: ['api', 'data', 'options', 'volatility', 'greeks'],
          maxRetries: 3,
        }
      );
    } catch (playwrightError) {
      console.error('Playwright scraping failed:', playwrightError);
      options = [];
    }

    console.log(`Total options before validation: ${options.length}`);
    
    const optionsData: OptionData[] = options
      .map((opt: any) => {
        const strike = String(opt.strike || '').trim();
        const type = String(opt.type || '').toUpperCase().trim();
        const latest = String(opt.latest || '').trim();
        const iv = String(opt.iv || '').trim();
        
        return { strike, type, latest, iv, original: opt };
      })
      .filter((opt: any) => {
        if (!opt.strike || !opt.type || !opt.latest || !opt.iv) {
          return false;
        }
        
        const invalidTexts = ['watchlist', 'dashboard', 'login', 'sign up', 'menu', 'navigation', 'retour', 'back'];
        const strikeLower = opt.strike.toLowerCase();
        const latestLower = opt.latest.toLowerCase();
        const ivLower = opt.iv.toLowerCase();
        if (invalidTexts.some(text => 
          strikeLower.includes(text) || latestLower.includes(text) || ivLower.includes(text)
        )) {
          return false;
        }
        
        const strikeNum = parseFloat(opt.strike.replace(/[^0-9.-]/g, ''));
        if (isNaN(strikeNum) || strikeNum <= 0) return false;
        
        const latestNum = parseFloat(opt.latest.replace(/[^0-9.-]/g, ''));
        if (isNaN(latestNum)) return false;
        
        const ivStr = opt.iv.replace(/%/g, '');
        const ivNum = parseFloat(ivStr.replace(/[^0-9.-]/g, ''));
        if (isNaN(ivNum) || ivNum < 0) return false;
        
        let normalizedType = opt.type;
        if (normalizedType.startsWith('C') || normalizedType.includes('CALL')) {
          normalizedType = 'C';
        } else if (normalizedType.startsWith('P') || normalizedType.includes('PUT')) {
          normalizedType = 'P';
        } else if (normalizedType !== 'C' && normalizedType !== 'P') {
          return false;
        }
        
        return true;
      })
      .map((opt: any) => {
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

    const seen = new Set<string>();
    const dedupedOptions = optionsData.filter((opt: OptionData) => {
      const key = `${opt.strike}-${opt.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Filter by optionType if specified (after all parsing)
    let filteredOptions = dedupedOptions;
    if (validOptionType) {
      filteredOptions = dedupedOptions.filter(opt => opt.type === validOptionType);
      console.log(`Filtered to ${filteredOptions.length} ${validOptionType === 'C' ? 'Call' : 'Put'} options`);
    }

    filteredOptions.sort((a: OptionData, b: OptionData) => {
      const strikeA = parseFloat(a.strike.replace(/[^0-9.-]/g, ''));
      const strikeB = parseFloat(b.strike.replace(/[^0-9.-]/g, ''));
      return strikeA - strikeB;
    });

    console.log(`Final extracted ${filteredOptions.length} options for ${contractSymbol}${validOptionType ? ` (type: ${validOptionType})` : ''}`);

    res.json({
      success: true,
      baseSymbol,
      contractSymbol,
      maturity: { monthCode, year },
      optionType: validOptionType || null,
      data: filteredOptions,
      count: filteredOptions.length,
      message: filteredOptions.length === 0 
        ? `Aucune option ${validOptionType === 'C' ? 'Call' : validOptionType === 'P' ? 'Put' : ''} trouvée pour cette maturité. Les données peuvent être en cours de chargement ou non disponibles.`
        : undefined,
    });
  } catch (error) {
    console.error('Error scraping options:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape options';
    res.status(500).json({ success: false, error: errorMessage });
  }
}
