// Month codes for futures contracts (F=Jan, G=Feb, H=Mar, J=Apr, K=May, M=Jun, N=Jul, Q=Aug, U=Sep, V=Oct, X=Nov, Z=Dec)
export const MONTH_CODES = 'FGHJKMNQUVXZ';

// Month names for display
export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

// Full month names
export const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Convert base symbol to Barchart format for options URL
 * Some symbols need conversion: 6E -> E6, 6J -> J6, etc.
 */
export function convertSymbolForOptions(baseSymbol: string): string {
  // Mapping for symbols that need conversion
  const symbolMap: Record<string, string> = {
    '6E': 'E6',  // Euro FX
    '6J': 'J6',  // Japanese Yen
    '6B': 'B6',  // British Pound
    '6A': 'A6',  // Australian Dollar
    '6C': 'C6',  // Canadian Dollar
    '6S': 'S6',  // Swiss Franc
    '6N': 'N6',  // New Zealand Dollar
    '6M': 'M6',  // Mexican Peso
    '6L': 'L6',  // Brazilian Real
    '6Z': 'Z6',  // South African Rand
    'DX': 'DX',  // US Dollar Index (no change)
  };
  
  return symbolMap[baseSymbol] || baseSymbol;
}

/**
 * Build contract symbol from base symbol, month code, and year
 * Example: buildContractSymbol('6E', 'H', 26) -> '6EH26'
 */
export function buildContractSymbol(baseSymbol: string, monthCode: string, year: number): string {
  const yearStr = year.toString().slice(-2); // Get last 2 digits
  return `${baseSymbol}${monthCode}${yearStr}`;
}

/**
 * Build contract symbol for options URL (uses converted symbol)
 * Example: buildOptionsContractSymbol('6E', 'H', 26) -> 'E6H26'
 */
export function buildOptionsContractSymbol(baseSymbol: string, monthCode: string, year: number): string {
  const convertedSymbol = convertSymbolForOptions(baseSymbol);
  const yearStr = year.toString().slice(-2);
  return `${convertedSymbol}${monthCode}${yearStr}`;
}

/**
 * Parse contract symbol to extract base symbol, month, and year
 * Example: parseContractSymbol('6EH26') -> { baseSymbol: '6E', monthCode: 'H', year: 2026 }
 */
export function parseContractSymbol(contractSymbol: string): {
  baseSymbol: string;
  monthCode: string;
  year: number;
} | null {
  // Pattern: baseSymbol (2-3 chars) + monthCode (1 char) + year (2 digits)
  const match = contractSymbol.match(/^([A-Z0-9]{2,3})([FGHJKMNQUVXZ])(\d{2})$/i);
  if (!match) return null;
  
  const [, baseSymbol, monthCode, yearStr] = match;
  const year = 2000 + parseInt(yearStr);
  
  return {
    baseSymbol: baseSymbol.toUpperCase(),
    monthCode: monthCode.toUpperCase(),
    year,
  };
}

/**
 * Get month name from month code
 */
export function getMonthName(monthCode: string): string {
  const index = MONTH_CODES.indexOf(monthCode.toUpperCase());
  return index >= 0 ? MONTH_NAMES[index] : monthCode;
}

/**
 * Get full month name from month code
 */
export function getFullMonthName(monthCode: string): string {
  const index = MONTH_CODES.indexOf(monthCode.toUpperCase());
  return index >= 0 ? FULL_MONTH_NAMES[index] : monthCode;
}

/**
 * Generate list of available maturities (expiration dates)
 * Returns array of { monthCode, monthName, year, displayName, contractSymbol }
 */
export function generateMaturities(
  baseSymbol: string,
  startYear: number = 2026,
  endYear: number = 2028,
  includeAllMonths: boolean = false
): Array<{
  monthCode: string;
  monthName: string;
  year: number;
  displayName: string;
  contractSymbol: string;
  optionsContractSymbol: string;
}> {
  const maturities: Array<{
    monthCode: string;
    monthName: string;
    year: number;
    displayName: string;
    contractSymbol: string;
    optionsContractSymbol: string;
  }> = [];
  
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-11
  
  for (let year = startYear; year <= endYear; year++) {
    // For current year, start from current month
    // For future years, include all months
    let startMonthIndex = 0;
    if (year === currentYear) {
      // Start from current month for current year
      startMonthIndex = currentMonth;
    }
    
    for (let i = startMonthIndex; i < MONTH_CODES.length; i++) {
      const monthCode = MONTH_CODES[i];
      const monthName = MONTH_NAMES[i];
      const displayName = `${monthName} ${year}`;
      const contractSymbol = buildContractSymbol(baseSymbol, monthCode, year);
      const optionsContractSymbol = buildOptionsContractSymbol(baseSymbol, monthCode, year);
      
      maturities.push({
        monthCode,
        monthName,
        year,
        displayName,
        contractSymbol,
        optionsContractSymbol,
      });
    }
  }
  
  return maturities;
}

/**
 * Format maturity for display
 */
export function formatMaturity(monthCode: string, year: number): string {
  const monthName = getMonthName(monthCode);
  return `${monthName} ${year}`;
}

