import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FuturesContract } from '@/components/FuturesContractsTable';

export function useCurrencyFutures(currencyId: string | null) {
  return useQuery({
    queryKey: ['currencyFutures', currencyId],
    queryFn: async (): Promise<FuturesContract[]> => {
      if (!currencyId) return [];

      console.log('Fetching futures for currency:', currencyId);
      
      const { data, error } = await supabase.functions.invoke('scrape-forex-prices', {
        body: { symbol: currencyId }
      });
      
      if (error) {
        console.error('Error fetching futures:', error);
        // Try to extract error message from the error object
        const errorMessage = error.message || error.toString() || 'Unknown error';
        throw new Error(`Failed to fetch futures: ${errorMessage}`);
      }
      
      // Check if data exists and has success property
      if (!data) {
        console.error('No data returned from function');
        throw new Error('No data returned from the server. Please check the logs.');
      }
      
      if (!data.success) {
        console.error('Scraping failed:', data);
        const errorMsg = data.error || 'Failed to scrape futures data';
        throw new Error(errorMsg);
      }
      
      if (data.data && data.data.length > 0) {
        console.log(`Fetched ${data.data.length} contracts for ${currencyId}`);
        return data.data.map((item: { contract: string; latest: string; change?: string; high?: string; low?: string; open?: string; volume?: string; changePercent?: string }) => ({
          contract: item.contract,
          latest: item.latest,
          change: item.change,
          high: item.high,
          low: item.low,
          open: item.open,
          volume: item.volume,
          changePercent: item.changePercent,
        }));
      }
      
      console.log('No data returned for', currencyId);
      return [];
    },
    enabled: !!currencyId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
    retryDelay: 1000,
  });
}
