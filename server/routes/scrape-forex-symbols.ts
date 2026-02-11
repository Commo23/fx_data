import { Request, Response } from 'express';
import { scrapeWithPlaywright, type Page } from '../playwright-utils';

export async function scrapeForexSymbols(req: Request, res: Response) {
  try {
    const url = 'https://www.barchart.com/futures/currencies';
    console.log('Scraping forex symbols from Barchart...');

    let markdown = '';
    let html = '';
    
    try {
      const result = await scrapeWithPlaywright(
        url,
        async (page: Page) => {
          console.log('Page loaded, extracting content...');
          const pageHtml = await page.content();
          const bodyText = await page.evaluate(() => document.body.innerText);
          return { markdown: bodyText, html: pageHtml };
        },
        {
          waitForSelector: 'table, [class*="table"], [class*="currency"]',
          interceptJsonUrls: ['api', 'data', 'symbols', 'currencies'],
          maxRetries: 3,
        }
      );
      markdown = result.markdown;
      html = result.html;
    } catch (playwrightError) {
      console.error('Playwright scraping failed:', playwrightError);
      throw new Error(`Scraping failed: ${playwrightError instanceof Error ? playwrightError.message : String(playwrightError)}`);
    }

    // Extract symbols using regex patterns
    const symbolPatterns = [
      /\b(6E|6J|6B|6A|6C|6S|6N|6M|6L|6R|6Z|DX)\b/gi,
      /\b([A-Z]{2,3})\s+(?:Euro|Yen|Pound|Dollar|Franc|Peso|Real|Ruble|Rand|Index)\b/gi,
    ];

    const symbols = new Set<string>();
    
    for (const pattern of symbolPatterns) {
      const matches = [...markdown.matchAll(pattern)];
      for (const match of matches) {
        if (match[1]) {
          symbols.add(match[1].toUpperCase());
        }
      }
    }

    const symbolArray = Array.from(symbols).sort();

    console.log(`Found ${symbolArray.length} symbols`);

    res.json({
      success: true,
      symbols: symbolArray,
      count: symbolArray.length,
    });
  } catch (error) {
    console.error('Error scraping symbols:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape symbols';
    res.status(500).json({ success: false, error: errorMessage });
  }
}
