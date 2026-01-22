import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SearchFilterProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterType: string;
  onFilterChange: (value: string) => void;
}

export function SearchFilter({
  searchTerm,
  onSearchChange,
  filterType,
  onFilterChange,
}: SearchFilterProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by symbol or name..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-secondary border-border font-mono"
        />
      </div>
      
      <Select value={filterType} onValueChange={onFilterChange}>
        <SelectTrigger className="w-full sm:w-48 bg-secondary border-border">
          <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="Filter" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Contracts</SelectItem>
          <SelectItem value="gainers">Gainers Only</SelectItem>
          <SelectItem value="losers">Losers Only</SelectItem>
          <SelectItem value="usd">USD Index</SelectItem>
          <SelectItem value="eur">Euro FX</SelectItem>
          <SelectItem value="jpy">Japanese Yen</SelectItem>
          <SelectItem value="gbp">British Pound</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
