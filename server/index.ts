import express from 'express';
import cors from 'cors';
import { scrapeForexOptions } from './routes/scrape-forex-options';
import { scrapeForexPrices } from './routes/scrape-forex-prices';
import { scrapeForexSymbols } from './routes/scrape-forex-symbols';
import { scrapeAllForex } from './routes/scrape-all-forex';
import { cleanupBrowser } from './playwright-utils';

const app = express();
const PORT = process.env.PORT || 3001;

// Prevent process from exiting on uncaught errors (log instead)
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

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

// Start server on PORT only (no fallback to other ports)
const portNum = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
const server = app.listen(portNum, () => {
  console.log(`🚀 Server running on http://localhost:${portNum}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${portNum} is already in use. Stop the other process first:`);
    console.error(`  npm run stop-server`);
    console.error(`Or on Windows: netstat -ano | findstr :${portNum}  then  taskkill /PID <PID> /F`);
    process.exit(1);
  }
  console.error('Server error:', err);
  process.exit(1);
});

// Cleanup on shutdown
async function shutdown() {
  console.log('Shutting down gracefully...');
  server.close();
  await cleanupBrowser();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
