import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CURRENCIES } from './CurrencySelector';
import { useCurrencyOptions } from '@/hooks/useCurrencyOptions';
import { generateMaturities, formatMaturity } from '@/lib/utils/contractUtils';
import { useState } from 'react';

export interface OptionData {
  strike: string;
  type: 'C' | 'P';
  latest: string;
  iv: string;
}

interface OptionsTableProps {
  currencyId: string;
  onBack: () => void;
}

export function OptionsTable({ currencyId, onBack }: OptionsTableProps) {
  const currency = CURRENCIES.find(c => c.id === currencyId);
  
  // Generate available maturities (from current year to 2028)
  const currentYear = new Date().getFullYear();
  const maturities = generateMaturities(currencyId, currentYear, 2028);
  
  // Default to first available maturity
  const [selectedMaturity, setSelectedMaturity] = useState(maturities[0] || null);
  
  // Fetch options data
  const { data: options, isLoading, isError, error } = useCurrencyOptions(
    currencyId,
    selectedMaturity?.monthCode || null,
    selectedMaturity?.year || null
  );

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
            {currency?.name} - Options
          </h2>
        </div>
      </div>

      {/* Maturity Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-foreground">
          Maturité:
        </label>
        <Select
          value={selectedMaturity ? `${selectedMaturity.monthCode}-${selectedMaturity.year}` : ''}
          onValueChange={(value) => {
            const [monthCode, yearStr] = value.split('-');
            const year = parseInt(yearStr);
            const maturity = maturities.find(m => m.monthCode === monthCode && m.year === year);
            if (maturity) {
              setSelectedMaturity(maturity);
            }
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sélectionner une maturité" />
          </SelectTrigger>
          <SelectContent>
            {maturities.map((maturity) => (
              <SelectItem
                key={`${maturity.monthCode}-${maturity.year}`}
                value={`${maturity.monthCode}-${maturity.year}`}
              >
                {maturity.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedMaturity && (
          <span className="text-sm text-muted-foreground font-mono">
            {selectedMaturity.contractSymbol}
          </span>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-border last:border-0">
                <div className="shimmer h-5 w-24 rounded" />
                <div className="shimmer h-5 w-16 rounded" />
                <div className="shimmer h-5 w-32 rounded flex-1" />
                <div className="shimmer h-5 w-20 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="glass-card rounded-lg p-8 text-center">
          <p className="text-destructive mb-2 font-semibold">
            Erreur lors du chargement des options
          </p>
          <p className="text-muted-foreground text-sm">
            {error?.message || 'Une erreur est survenue. Veuillez réessayer.'}
          </p>
        </div>
      )}

      {/* Options Table */}
      {!isLoading && !isError && (
        <>
          {options && options.length === 0 ? (
            <div className="glass-card rounded-lg p-8 text-center">
              <p className="text-muted-foreground">
                Aucune option trouvée pour cette maturité. Les données peuvent être en cours de chargement.
              </p>
            </div>
          ) : (
            <div className="glass-card rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      Strike
                    </TableHead>
                    <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground text-center">
                      Type
                    </TableHead>
                    <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground text-right">
                      Latest
                    </TableHead>
                    <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground text-right">
                      IV
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {options?.map((option, index) => (
                    <TableRow
                      key={`${option.strike}-${option.type}-${index}`}
                      className="data-row border-border animate-fade-in"
                      style={{ animationDelay: `${index * 10}ms` }}
                    >
                      <TableCell className="font-mono font-semibold text-primary">
                        {option.strike}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                            option.type === 'C'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {option.type === 'C' ? 'Call' : 'Put'}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-right tabular-nums text-foreground">
                        {option.latest}
                      </TableCell>
                      <TableCell className="font-mono text-right tabular-nums text-foreground">
                        {option.iv}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-sm text-muted-foreground text-center">
            {options?.length || 0} option{options && options.length > 1 ? 's' : ''} disponible{options && options.length > 1 ? 's' : ''}
          </p>
        </>
      )}
    </div>
  );
}

