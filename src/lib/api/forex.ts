// API base URL - use Node.js server instead of Supabase Edge Functions
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface CurrencyFuture {
  symbol: string;
  name: string;
  contract: string;
  latest: string;
  change?: string;
  changePercent?: string;
}

export interface ForexApiResponse {
  success: boolean;
  currencies?: CurrencyFuture[];
  error?: string;
  count?: number;
  timestamp?: string;
  message?: string;
}

export const forexApi = {
  async fetchAllForexData(): Promise<ForexApiResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/scrape-all-forex`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data as ForexApiResponse;
    } catch (error) {
      console.error('Error fetching forex data:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async fetchSymbols(): Promise<{ success: boolean; symbols?: string[]; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/scrape-forex-symbols`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching symbols:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async fetchPricesForSymbol(symbol: string): Promise<ForexApiResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/scrape-forex-prices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbol }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching prices:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
};
