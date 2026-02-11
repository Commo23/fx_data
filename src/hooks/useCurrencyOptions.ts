import { useQuery } from '@tanstack/react-query';
import { OptionData } from '@/components/OptionsTable';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function useCurrencyOptions(
  baseSymbol: string | null,
  monthCode: string | null,
  year: number | null,
  optionType?: 'C' | 'P' | null
) {
  return useQuery({
    queryKey: ['currencyOptions', baseSymbol, monthCode, year, optionType],
    queryFn: async (): Promise<OptionData[]> => {
      if (!baseSymbol || !monthCode || !year) return [];

      console.log('Fetching options for:', { baseSymbol, monthCode, year, optionType });
      
      try {
        const response = await fetch(`${API_BASE_URL}/scrape-forex-options`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ baseSymbol, monthCode, year, optionType: optionType || undefined }),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
          console.error('Scraping failed:', data);
          const errorMsg = data.error || 'Échec du scraping des données d\'options';
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
      } catch (error) {
        console.error('Error fetching options:', error);
        if (error instanceof Error && (error.message.includes('408') || error.message.includes('timeout'))) {
          throw new Error('Le scraping prend trop de temps. Veuillez réessayer dans quelques instants.');
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Échec de la récupération des options: ${errorMessage}`);
      }
    },
    enabled: !!baseSymbol && !!monthCode && !!year,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
    retryDelay: 1000,
  });
}

