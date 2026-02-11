// Shared Playwright utilities for optimized web scraping
// @ts-ignore - Deno npm imports work at runtime even if IDE doesn't recognize them
import { chromium, Browser, Page } from 'npm:playwright@1.40.0';

// Re-export Page type for use in other functions
// @ts-ignore - Deno npm imports work at runtime even if IDE doesn't recognize them
export type { Page } from 'npm:playwright@1.40.0';

// Browser instance management with concurrency limiting
let browserInstance: Browser | null = null;
let browserPromise: Promise<Browser> | null = null;
const MAX_CONCURRENT_PAGES = 3;
let activePages = 0;
const pageQueue: Array<() => void> = [];

/**
 * Get or create a shared browser instance
 * Reuses browser within the same function execution for better performance
 * Note: In serverless environments, each request may be isolated,
 * but this still provides benefits within a single execution context
 */
async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  if (browserPromise) {
    return browserPromise;
  }

  try {
    browserPromise = chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
      ],
    });

    browserInstance = await browserPromise;
    browserPromise = null;

    // Clean up on browser close
    browserInstance.on('disconnected', () => {
      browserInstance = null;
      browserPromise = null;
    });

    return browserInstance;
  } catch (error) {
    browserPromise = null;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Failed to launch browser:', errorMsg);
    throw new Error(`Playwright browser launch failed: ${errorMsg}. This may be due to missing browser binaries in the serverless environment.`);
  }
}

/**
 * Wait for available slot in concurrency limit
 */
async function waitForSlot(): Promise<void> {
  if (activePages < MAX_CONCURRENT_PAGES) {
    activePages++;
    return;
  }

  return new Promise<void>((resolve) => {
    pageQueue.push(() => {
      activePages++;
      resolve();
    });
  });
}

/**
 * Release a slot in concurrency limit
 */
function releaseSlot(): void {
  activePages--;
  const next = pageQueue.shift();
  if (next) {
    next();
  }
}

/**
 * Create an optimized page with resource blocking and network interception
 */
async function createOptimizedPage(
  browser: Browser,
  interceptJsonUrls?: string[]
): Promise<{ page: Page; jsonResponses: Map<string, any> }> {
  await waitForSlot();

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const jsonResponses = new Map<string, any>();

  // Block unnecessary resources to improve performance
  await context.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    const url = route.request().url();

    // Block images, fonts, media, and unnecessary resources
    if (
      ['image', 'font', 'media', 'stylesheet', 'websocket'].includes(
        resourceType
      ) ||
      url.includes('analytics') ||
      url.includes('tracking') ||
      url.includes('advertising') ||
      url.includes('ads')
    ) {
      route.abort();
      return;
    }

    // Allow all other requests to continue (including JSON API calls)
    route.continue();
  });

  // Intercept network responses to extract JSON data
  if (interceptJsonUrls && interceptJsonUrls.length > 0) {
    context.on('response', async (response) => {
      const url = response.url();
      if (
        interceptJsonUrls.some((pattern) => url.includes(pattern)) &&
        response.headers()['content-type']?.includes('application/json')
      ) {
        try {
          const json = await response.json();
          jsonResponses.set(url, json);
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    });
  }

  const page = await context.newPage();

  // Set reasonable timeouts
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);

  return { page, jsonResponses };
}

/**
 * Navigate and wait for page to be ready using smart waits
 */
async function navigateAndWait(
  page: Page,
  url: string,
  options: {
    waitForSelector?: string;
    waitForUrl?: string | RegExp;
    waitForResponse?: string | RegExp;
    maxWaitTime?: number;
  } = {}
): Promise<void> {
  const {
    waitForSelector,
    waitForUrl,
    waitForResponse,
    maxWaitTime = 60000,
  } = options;

  const navigationPromise = page.goto(url, {
    waitUntil: 'domcontentloaded', // Faster initial load
    timeout: maxWaitTime,
  });

  // Wait for specific response if provided
  let responsePromise: Promise<any> | null = null;
  if (waitForResponse) {
    responsePromise = page.waitForResponse(
      typeof waitForResponse === 'string'
        ? (response) => response.url().includes(waitForResponse)
        : (response) => waitForResponse.test(response.url()),
      { timeout: maxWaitTime }
    );
  }

  // Wait for navigation
  await navigationPromise;

  // Wait for network to be idle (but with shorter timeout)
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch (e) {
    // Continue if networkidle times out - page might still be usable
    console.log('Networkidle timeout, continuing...');
  }

  // Wait for specific selector if provided
  if (waitForSelector) {
    try {
      await page.waitForSelector(waitForSelector, {
        timeout: maxWaitTime,
        state: 'visible',
      });
    } catch (e) {
      console.log(`Selector ${waitForSelector} not found, continuing...`);
    }
  }

  // Wait for specific URL if provided
  if (waitForUrl) {
    try {
      await page.waitForURL(
        typeof waitForUrl === 'string'
          ? (url) => url.includes(waitForUrl)
          : waitForUrl,
        { timeout: maxWaitTime }
      );
    } catch (e) {
      console.log('URL wait timeout, continuing...');
    }
  }

  // Wait for specific response if provided
  if (responsePromise) {
    try {
      await responsePromise;
    } catch (e) {
      console.log('Response wait timeout, continuing...');
    }
  }

  // Small additional wait for any remaining JavaScript
  await page.waitForTimeout(1000);
}

/**
 * Clean up page and release resources
 */
async function cleanupPage(page: Page): Promise<void> {
  try {
    const context = page.context();
    await page.close();
    await context.close();
  } catch (e) {
    console.error('Error cleaning up page:', e);
  } finally {
    releaseSlot();
  }
}

/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | null = null;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        throw lastError;
      }

      console.log(
        `Attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
        lastError.message
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Main scraping function with all optimizations
 */
export async function scrapeWithPlaywright<T>(
  url: string,
  extractor: (page: Page, jsonResponses: Map<string, any>) => Promise<T>,
  options: {
    waitForSelector?: string;
    waitForResponse?: string | RegExp;
    interceptJsonUrls?: string[];
    maxRetries?: number;
  } = {}
): Promise<T> {
  try {
    return await retryWithBackoff(async () => {
      const browser = await getBrowser();
      const { page, jsonResponses } = await createOptimizedPage(
        browser,
        options.interceptJsonUrls
      );

      try {
        await navigateAndWait(page, url, {
          waitForSelector: options.waitForSelector,
          waitForResponse: options.waitForResponse,
        });

        return await extractor(page, jsonResponses);
      } finally {
        await cleanupPage(page);
      }
    }, {
      maxRetries: options.maxRetries ?? 3,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Playwright scraping failed:', errorMsg);
    
    // If it's a browser launch error, provide helpful message
    if (errorMsg.includes('browser launch') || errorMsg.includes('Executable doesn\'t exist') || errorMsg.includes('Browser closed')) {
      throw new Error(`Playwright is not available in this environment. Browser binaries are missing. Error: ${errorMsg}`);
    }
    
    throw error;
  }
}

/**
 * Cleanup browser instance (call on function shutdown if needed)
 */
export async function cleanupBrowser(): Promise<void> {
  if (browserInstance && browserInstance.isConnected()) {
    await browserInstance.close();
    browserInstance = null;
    browserPromise = null;
  }
}

/**
 * Fallback scraping function using fetch (when Playwright is not available)
 * This is a simpler approach that works in serverless environments
 */
export async function scrapeWithFetch(
  url: string,
  options: {
    headers?: Record<string, string>;
    timeout?: number;
  } = {}
): Promise<string> {
  const { headers = {}, timeout = 30000 } = options;
  
  // Set up default headers to mimic a browser
  const defaultHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    ...headers,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      headers: defaultHeaders,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return html;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}
