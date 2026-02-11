import { Request, Response } from 'express';
import { scrapeWithPlaywright, type Page } from '../playwright-utils';

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

export async function scrapeAllForex(req: Request, res: Response) {
  try {
    const url = 'https://www.barchart.com/futures/currencies';
    console.log('Scraping all forex data from Barchart currencies page...');

    let markdown = '';
    
    try {
      markdown = await scrapeWithPlaywright(
        url,
        async (page: Page) => {
          console.log('Page loaded, extracting content...');
          const bodyText = await page.evaluate(() => document.body.innerText);
          return bodyText;
        },
        {
          waitForSelector: 'table, [class*="table"], [class*="currency"]',
          interceptJsonUrls: ['api', 'data', 'currencies', 'futures'],
          maxRetries: 3,
        }
      );
    } catch (playwrightError) {
      console.error('Playwright scraping failed:', playwrightError);
      throw new Error(`Scraping failed: ${playwrightError instanceof Error ? playwrightError.message : String(playwrightError)}`);
    }

    // Parse currency futures data from markdown
    const currencies: any[] = [];
    const MONTH_CODES = 'FGHJKMNQUVXZ';

    for (const [symbol, info] of Object.entries(CURRENCY_FUTURES)) {
      // Look for contract patterns like 6EH25, 6EJ25, etc.
      const contractPattern = new RegExp(`(${symbol}[${MONTH_CODES}]\\d{2})`, 'gi');
      const contractMatches = [...markdown.matchAll(contractPattern)];
      
      if (contractMatches.length > 0) {
        // Find the latest price near the contract
        const firstContract = contractMatches[0][1];
        const contractIndex = markdown.indexOf(firstContract);
        const context = markdown.substring(
          Math.max(0, contractIndex - 100),
          Math.min(markdown.length, contractIndex + 500)
        );
        
        // Look for price patterns
        const pricePattern = /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g;
        const priceMatches = [...context.matchAll(pricePattern)];
        
        currencies.push({
          symbol: info.baseSymbol,
          name: info.name,
          contract: firstContract,
          latest: priceMatches.length > 0 ? priceMatches[0][1] : '',
        });
      }
    }

    console.log(`Found ${currencies.length} currencies`);

    res.json({
      success: true,
      currencies,
      count: currencies.length,
    });
  } catch (error) {
    console.error('Error scraping all forex:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape all forex';
    res.status(500).json({ success: false, error: errorMessage });
  }
}
