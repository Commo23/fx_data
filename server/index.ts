import express from 'express';
import cors from 'cors';
import { scrapeForexOptions } from './routes/scrape-forex-options';
import { scrapeForexPrices } from './routes/scrape-forex-prices';
import { scrapeForexSymbols } from './routes/scrape-forex-symbols';
import { scrapeAllForex } from './routes/scrape-all-forex';
import { cleanupBrowser } from './playwright-utils';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.post('/api/scrape-forex-options', scrapeForexOptions);
app.post('/api/scrape-forex-prices', scrapeForexPrices);
app.post('/api/scrape-forex-symbols', scrapeForexSymbols);
app.post('/api/scrape-all-forex', scrapeAllForex);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Cleanup on shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await cleanupBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await cleanupBrowser();
  process.exit(0);
});
