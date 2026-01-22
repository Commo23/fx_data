import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OptionData } from '@/components/OptionsTable';

export function useCurrencyOptions(
  baseSymbol: string | null,
  monthCode: string | null,
  year: number | null
) {
  return useQuery({
    queryKey: ['currencyOptions', baseSymbol, monthCode, year],
    queryFn: async (): Promise<OptionData[]> => {
      if (!baseSymbol || !monthCode || !year) return [];

      console.log('Fetching options for:', { baseSymbol, monthCode, year });
      
      const { data, error } = await supabase.functions.invoke('scrape-forex-options', {
        body: { baseSymbol, monthCode, year }
      });
      
      if (error) {
        console.error('Error fetching options:', error);
        const errorMessage = error.message || error.toString() || 'Unknown error';
        throw new Error(`Failed to fetch options: ${errorMessage}`);
      }
      
      if (!data) {
        console.error('No data returned from function');
        throw new Error('No data returned from the server. Please check the logs.');
      }
      
      if (!data.success) {
        console.error('Scraping failed:', data);
        const errorMsg = data.error || 'Failed to scrape options data';
        throw new Error(errorMsg);
      }
      
      if (data.data && data.data.length > 0) {
        console.log(`Fetched ${data.data.length} options for ${baseSymbol} ${monthCode}${year}`);
        return data.data.map((item: { strike: string; type: string; latest: string; iv: string }) => ({
          strike: item.strike,
          type: item.type as 'C' | 'P',
          latest: item.latest,
          iv: item.iv,
        }));
      }
      
      console.log('No options returned for', baseSymbol, monthCode, year);
      return [];
    },
    enabled: !!baseSymbol && !!monthCode && !!year,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
    retryDelay: 1000,
  });
}

