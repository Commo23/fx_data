import { RefreshCw, Clock, Wifi, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardHeaderProps {
  lastUpdated?: string;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  dataCount?: number;
}

export function DashboardHeader({ 
  lastUpdated, 
  isRefreshing, 
  onRefresh,
  dataCount 
}: DashboardHeaderProps) {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-success pulse-dot" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  Forex Futures Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                  Contrats futures de devises
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {dataCount !== undefined && (
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <Wifi className="h-4 w-4 text-success" />
                <span>{dataCount} éléments</span>
              </div>
            )}
            
            {lastUpdated && (
              <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Mis à jour: {new Date(lastUpdated).toLocaleTimeString()}</span>
              </div>
            )}

            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Actualiser</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
