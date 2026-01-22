import { TrendingUp, TrendingDown, Minus, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CURRENCIES } from './CurrencySelector';

export interface FuturesContract {
  contract: string;
  latest: string;
  change?: string;
  high?: string;
  low?: string;
  open?: string;
  volume?: string;
  changePercent?: string;
}

interface FuturesContractsTableProps {
  currencyId: string;
  contracts: FuturesContract[];
  isLoading: boolean;
  isError?: boolean;
  error?: Error | null;
  onBack: () => void;
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

export function FuturesContractsTable({ 
  currencyId, 
  contracts, 
  isLoading,
  isError = false,
  error = null,
  onBack 
}: FuturesContractsTableProps) {
  const currency = CURRENCIES.find(c => c.id === currencyId);
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour aux devises
        </Button>
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-border last:border-0">
                <div className="shimmer h-5 w-24 rounded" />
                <div className="shimmer h-5 w-32 rounded flex-1" />
                <div className="shimmer h-5 w-20 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour aux devises
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{currency?.flag}</span>
          <h2 className="text-xl font-semibold text-foreground">
            {currency?.name} - Contrats Futures
          </h2>
        </div>
      </div>

      {isError ? (
        <div className="glass-card rounded-lg p-8 text-center">
          <p className="text-destructive mb-2 font-semibold">
            Erreur lors du chargement des données
          </p>
          <p className="text-muted-foreground text-sm">
            {error?.message || 'Une erreur est survenue. Veuillez réessayer.'}
          </p>
          <p className="text-muted-foreground text-xs mt-4">
            Vérifiez que les variables d'environnement Supabase sont configurées et que la clé API Firecrawl est définie.
          </p>
        </div>
      ) : contracts.length === 0 ? (
        <div className="glass-card rounded-lg p-8 text-center">
          <p className="text-muted-foreground">
            Aucun contrat trouvé pour cette devise. Les données peuvent être en cours de chargement.
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Contrat
                </TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground text-right">
                  Dernier Prix
                </TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground text-right">
                  Variation
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((contract, index) => {
                const { icon: Icon, className } = getPriceChangeIndicator(contract.change);
                
                return (
                  <TableRow 
                    key={`${contract.contract}-${index}`}
                    className="data-row border-border animate-fade-in"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <TableCell className="font-mono font-semibold text-primary">
                      {contract.contract}
                    </TableCell>
                    <TableCell className="font-mono text-right tabular-nums text-foreground">
                      {contract.latest}
                    </TableCell>
                    <TableCell className={`font-mono text-right tabular-nums ${className}`}>
                      <div className="flex items-center justify-end gap-1">
                        <Icon className="h-3 w-3" />
                        <span>{formatChange(contract.change)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-sm text-muted-foreground text-center">
        {contracts.length} contrat{contracts.length > 1 ? 's' : ''} disponible{contracts.length > 1 ? 's' : ''}
      </p>
    </div>
  );
}
