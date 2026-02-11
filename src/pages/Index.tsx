import { useState, useEffect } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { CurrencySelector, CURRENCIES } from '@/components/CurrencySelector';
import { FuturesContractsTable } from '@/components/FuturesContractsTable';
import { OptionsTable } from '@/components/OptionsTable';
import { useCurrencyFutures } from '@/hooks/useCurrencyFutures';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Index = () => {
  const queryClient = useQueryClient();
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'futures' | 'options'>('futures');
  
  const { data: contracts, isLoading, isFetching, isError, error, dataUpdatedAt } = useCurrencyFutures(selectedCurrency);

  // Debug: Log environment variables
  useEffect(() => {
    console.log('Supabase Config:', {
      url: import.meta.env.VITE_SUPABASE_URL ? '✓ Configured' : '✗ Missing',
      key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? '✓ Configured' : '✗ Missing',
    });
  }, []);

  const handleRefresh = () => {
    if (selectedCurrency) {
      queryClient.invalidateQueries({ queryKey: ['currencyFutures', selectedCurrency] });
    }
  };

  const handleBack = () => {
    setSelectedCurrency(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        lastUpdated={dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : undefined}
        isRefreshing={isFetching}
        onRefresh={selectedCurrency ? handleRefresh : undefined}
        dataCount={selectedCurrency ? contracts?.length : CURRENCIES.length}
      />
      
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-6">
          {!selectedCurrency ? (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Sélectionnez une devise
                </h2>
                <p className="text-muted-foreground">
                  Cliquez sur une devise pour voir ses contrats futures
                </p>
              </div>
              <CurrencySelector 
                selectedCurrency={selectedCurrency}
                onSelectCurrency={setSelectedCurrency}
              />
            </>
          ) : (
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'futures' | 'options')} className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                <TabsTrigger value="futures">Futures</TabsTrigger>
                <TabsTrigger value="options">Options</TabsTrigger>
              </TabsList>
              
              <TabsContent value="futures" className="mt-0">
            <FuturesContractsTable
              currencyId={selectedCurrency}
              contracts={contracts || []}
              isLoading={isLoading}
                  isError={isError}
                  error={error}
                  onBack={handleBack}
                />
              </TabsContent>
              
              <TabsContent value="options" className="mt-0">
                <OptionsTable
                  currencyId={selectedCurrency}
              onBack={handleBack}
            />
              </TabsContent>
            </Tabs>
          )}
          
        </div>
      </main>
    </div>
  );
};

export default Index;
