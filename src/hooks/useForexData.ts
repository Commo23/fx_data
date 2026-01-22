import { useQuery } from '@tanstack/react-query';
import { forexApi, CurrencyFuture } from '@/lib/api/forex';

// Sample data to show while loading or if scraping fails
const SAMPLE_FOREX_DATA: CurrencyFuture[] = [
  { symbol: 'DXH25', name: 'US Dollar Index', contract: 'DXH25', latest: '108.250', change: '-0.145' },
  { symbol: '6EH25', name: 'Euro FX', contract: '6EH25', latest: '1.0425', change: '+0.0015' },
  { symbol: '6JH25', name: 'Japanese Yen', contract: '6JH25', latest: '0.006745', change: '-0.000012' },
  { symbol: '6BH25', name: 'British Pound', contract: '6BH25', latest: '1.2185', change: '+0.0023' },
  { symbol: '6AH25', name: 'Australian Dollar', contract: '6AH25', latest: '0.6245', change: '-0.0018' },
  { symbol: '6CH25', name: 'Canadian Dollar', contract: '6CH25', latest: '0.6985', change: '+0.0008' },
  { symbol: '6SH25', name: 'Swiss Franc', contract: '6SH25', latest: '1.1125', change: '+0.0032' },
  { symbol: '6NH25', name: 'New Zealand Dollar', contract: '6NH25', latest: '0.5645', change: '-0.0025' },
  { symbol: '6MH25', name: 'Mexican Peso', contract: '6MH25', latest: '0.0485', change: '+0.0003' },
  { symbol: 'DXM25', name: 'US Dollar Index Jun', contract: 'DXM25', latest: '107.985', change: '-0.120' },
  { symbol: '6EM25', name: 'Euro FX Jun', contract: '6EM25', latest: '1.0445', change: '+0.0012' },
  { symbol: '6JM25', name: 'Japanese Yen Jun', contract: '6JM25', latest: '0.006765', change: '-0.000008' },
];

export function useForexData() {
  return useQuery({
    queryKey: ['forexData'],
    queryFn: async () => {
      const response = await forexApi.fetchAllForexData();
      
      if (response.success && response.currencies && response.currencies.length > 0) {
        return response.currencies;
      }
      
      // If scraping returned no data or failed, use sample data
      console.log('Using sample data:', response.message || response.error);
      return SAMPLE_FOREX_DATA;
    },
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
    placeholderData: SAMPLE_FOREX_DATA,
  });
}

export function useForexSymbols() {
  return useQuery({
    queryKey: ['forexSymbols'],
    queryFn: async () => {
      const response = await forexApi.fetchSymbols();
      
      if (response.success && response.symbols) {
        return response.symbols;
      }
      
      throw new Error(response.error || 'Failed to fetch symbols');
    },
    staleTime: 30 * 60 * 1000, // Symbols don't change often
  });
}
