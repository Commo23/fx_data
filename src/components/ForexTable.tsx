import { CurrencyFuture } from '@/lib/api/forex';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ForexTableProps {
  data: CurrencyFuture[];
  isLoading?: boolean;
}

function getPriceChangeIndicator(change?: string) {
  if (!change) return { icon: Minus, className: 'price-neutral' };
  
  const numChange = parseFloat(change.replace(/[^0-9.-]/g, ''));
  
  if (numChange > 0) {
    return { icon: TrendingUp, className: 'price-gain' };
  } else if (numChange < 0) {
    return { icon: TrendingDown, className: 'price-loss' };
  }
  
  return { icon: Minus, className: 'price-neutral' };
}

function formatChange(change?: string): string {
  if (!change) return '—';
  
  const numChange = parseFloat(change.replace(/[^0-9.-]/g, ''));
  const sign = numChange > 0 ? '+' : '';
  
  return `${sign}${change}`;
}

export function ForexTable({ data, isLoading }: ForexTableProps) {
  if (isLoading) {
    return (
      <div className="glass-card rounded-lg overflow-hidden">
        <div className="p-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-border last:border-0">
              <div className="shimmer h-5 w-20 rounded" />
              <div className="shimmer h-5 w-32 rounded flex-1" />
              <div className="shimmer h-5 w-24 rounded" />
              <div className="shimmer h-5 w-20 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Contract
            </TableHead>
            <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Name
            </TableHead>
            <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground text-right">
              Latest
            </TableHead>
            <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground text-right">
              Change
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((currency, index) => {
            const { icon: Icon, className } = getPriceChangeIndicator(currency.change);
            
            return (
              <TableRow 
                key={`${currency.symbol}-${index}`}
                className="data-row border-border animate-fade-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <TableCell className="font-mono font-semibold text-primary">
                  {currency.contract}
                </TableCell>
                <TableCell className="text-foreground">
                  {currency.name}
                </TableCell>
                <TableCell className="font-mono text-right tabular-nums text-foreground">
                  {currency.latest}
                </TableCell>
                <TableCell className={`font-mono text-right tabular-nums ${className}`}>
                  <div className="flex items-center justify-end gap-1">
                    <Icon className="h-3 w-3" />
                    <span>{formatChange(currency.change)}</span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
