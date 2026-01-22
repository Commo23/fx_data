import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';

export interface Currency {
  id: string;
  name: string;
  symbol: string;
  flag?: string;
}

export const CURRENCIES: Currency[] = [
  { id: 'DX', name: 'US Dollar Index', symbol: 'DX', flag: '🇺🇸' },
  { id: '6E', name: 'Euro FX', symbol: '6E', flag: '🇪🇺' },
  { id: '6J', name: 'Japanese Yen', symbol: '6J', flag: '🇯🇵' },
  { id: '6B', name: 'British Pound', symbol: '6B', flag: '🇬🇧' },
  { id: '6A', name: 'Australian Dollar', symbol: '6A', flag: '🇦🇺' },
  { id: '6C', name: 'Canadian Dollar', symbol: '6C', flag: '🇨🇦' },
  { id: '6S', name: 'Swiss Franc', symbol: '6S', flag: '🇨🇭' },
  { id: '6N', name: 'New Zealand Dollar', symbol: '6N', flag: '🇳🇿' },
  { id: '6M', name: 'Mexican Peso', symbol: '6M', flag: '🇲🇽' },
  { id: '6L', name: 'Brazilian Real', symbol: '6L', flag: '🇧🇷' },
  { id: '6Z', name: 'South African Rand', symbol: '6Z', flag: '🇿🇦' },
];

interface CurrencySelectorProps {
  selectedCurrency: string | null;
  onSelectCurrency: (currencyId: string) => void;
}

export function CurrencySelector({ selectedCurrency, onSelectCurrency }: CurrencySelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {CURRENCIES.map((currency) => (
        <Card
          key={currency.id}
          onClick={() => onSelectCurrency(currency.id)}
          className={`
            glass-card p-4 cursor-pointer transition-all duration-200
            hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10
            ${selectedCurrency === currency.id ? 'border-primary bg-primary/10' : ''}
          `}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{currency.flag}</span>
              <div>
                <p className="font-mono font-semibold text-primary">{currency.symbol}</p>
                <p className="text-sm text-muted-foreground">{currency.name}</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </Card>
      ))}
    </div>
  );
}
