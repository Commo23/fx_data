import { supabase } from '@/integrations/supabase/client';

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
    const { data, error } = await supabase.functions.invoke('scrape-all-forex');
    
    if (error) {
      console.error('Error fetching forex data:', error);
      return { success: false, error: error.message };
    }
    
    return data as ForexApiResponse;
  },

  async fetchSymbols(): Promise<{ success: boolean; symbols?: string[]; error?: string }> {
    const { data, error } = await supabase.functions.invoke('scrape-forex-symbols');
    
    if (error) {
      console.error('Error fetching symbols:', error);
      return { success: false, error: error.message };
    }
    
    return data;
  },

  async fetchPricesForSymbol(symbol: string): Promise<ForexApiResponse> {
    const { data, error } = await supabase.functions.invoke('scrape-forex-prices', {
      body: { symbol }
    });
    
    if (error) {
      console.error('Error fetching prices:', error);
      return { success: false, error: error.message };
    }
    
    return data;
  }
};
