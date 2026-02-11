import { useQuery } from '@tanstack/react-query';
import { FuturesContract } from '@/components/FuturesContractsTable';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function useCurrencyFutures(currencyId: string | null) {
  return useQuery({
    queryKey: ['currencyFutures', currencyId],
    queryFn: async (): Promise<FuturesContract[]> => {
      if (!currencyId) return [];

      console.log('Fetching futures for currency:', currencyId);
      
      try {
        const response = await fetch(`${API_BASE_URL}/scrape-forex-prices`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ symbol: currencyId }),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data || !data.success) {
          console.error('Scraping failed:', data);
          const errorMsg = data?.error || 'Failed to scrape futures data';
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
      } catch (error) {
        console.error('Error fetching futures:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to fetch futures: ${errorMessage}`);
      }
    },
    enabled: !!currencyId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
    retryDelay: 1000,
  });
}
