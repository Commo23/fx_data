import { CurrencyFuture } from '@/lib/api/forex';
import { TrendingUp, TrendingDown, BarChart3, DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatsCardsProps {
  data: CurrencyFuture[];
}

export function StatsCards({ data }: StatsCardsProps) {
  const stats = calculateStats(data);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Contracts"
        value={stats.totalContracts.toString()}
        icon={BarChart3}
        iconColor="text-accent"
      />
      <StatCard
        title="Gainers"
        value={stats.gainers.toString()}
        icon={TrendingUp}
        iconColor="text-success"
        subtitle={`${stats.gainersPercent.toFixed(0)}%`}
      />
      <StatCard
        title="Losers"
        value={stats.losers.toString()}
        icon={TrendingDown}
        iconColor="text-destructive"
        subtitle={`${stats.losersPercent.toFixed(0)}%`}
      />
      <StatCard
        title="USD Index"
        value={stats.dxPrice || '—'}
        icon={DollarSign}
        iconColor="text-primary"
        subtitle={stats.dxChange}
      />
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  iconColor: string;
  subtitle?: string;
}

function StatCard({ title, value, icon: Icon, iconColor, subtitle }: StatCardProps) {
  return (
    <Card className="glass-card border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              {title}
            </p>
            <p className="text-2xl font-mono font-semibold text-foreground">
              {value}
            </p>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">
                {subtitle}
              </p>
            )}
          </div>
          <div className={`p-2 rounded-lg bg-secondary ${iconColor}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function calculateStats(data: CurrencyFuture[]) {
  const totalContracts = data.length;
  
  let gainers = 0;
  let losers = 0;
  
  data.forEach(currency => {
    if (currency.change) {
      const change = parseFloat(currency.change.replace(/[^0-9.-]/g, ''));
      if (change > 0) gainers++;
      else if (change < 0) losers++;
    }
  });
  
  const dxContract = data.find(c => c.symbol.startsWith('DX'));
  
  return {
    totalContracts,
    gainers,
    losers,
    gainersPercent: totalContracts > 0 ? (gainers / totalContracts) * 100 : 0,
    losersPercent: totalContracts > 0 ? (losers / totalContracts) * 100 : 0,
    dxPrice: dxContract?.latest,
    dxChange: dxContract?.change ? (parseFloat(dxContract.change) > 0 ? '+' : '') + dxContract.change : undefined,
  };
}
