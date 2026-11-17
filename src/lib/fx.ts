export type LocalCurrencyCode =
  | 'USD'
  | 'ZAR'
  | 'EUR'
  | 'GBP'
  | 'NGN'
  | 'KES'
  | 'CAD'
  | 'AUD'
  | 'INR'
  | 'AED'
  | 'SGD'
  | 'JPY'
  | 'BRL';

export interface CurrencyMeta {
  code: LocalCurrencyCode;
  symbol: string;
  name: string;
  region: string;
  locale: string;
  defaultRatePerUSD: number;
  decimals: number;
}

export const CURRENCY_CATALOG: Record<LocalCurrencyCode, CurrencyMeta> = {
  USD: {
    code: 'USD',
    symbol: 'US$',
    name: 'US Dollar',
    region: 'United States',
    locale: 'en-US',
    defaultRatePerUSD: 1,
    decimals: 2,
  },
  ZAR: {
    code: 'ZAR',
    symbol: 'R',
    name: 'South African Rand',
    region: 'South Africa',
    locale: 'en-ZA',
    defaultRatePerUSD: 18.52,
    decimals: 0,
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    region: 'Eurozone',
    locale: 'en-IE',
    defaultRatePerUSD: 0.92,
    decimals: 2,
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    region: 'United Kingdom',
    locale: 'en-GB',
    defaultRatePerUSD: 0.79,
    decimals: 2,
  },
  NGN: {
    code: 'NGN',
    symbol: '₦',
    name: 'Nigerian Naira',
    region: 'Nigeria',
    locale: 'en-NG',
    defaultRatePerUSD: 1640,
    decimals: 0,
  },
  KES: {
    code: 'KES',
    symbol: 'KSh ',
    name: 'Kenyan Shilling',
    region: 'Kenya',
    locale: 'en-KE',
    defaultRatePerUSD: 129,
    decimals: 0,
  },
  CAD: {
    code: 'CAD',
    symbol: 'CA$',
    name: 'Canadian Dollar',
    region: 'Canada',
    locale: 'en-CA',
    defaultRatePerUSD: 1.39,
    decimals: 2,
  },
  AUD: {
    code: 'AUD',
    symbol: 'A$',
    name: 'Australian Dollar',
    region: 'Australia',
    locale: 'en-AU',
    defaultRatePerUSD: 1.53,
    decimals: 2,
  },
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    region: 'India',
    locale: 'en-IN',
    defaultRatePerUSD: 84.4,
    decimals: 0,
  },
  AED: {
    code: 'AED',
    symbol: 'AED ',
    name: 'UAE Dirham',
    region: 'United Arab Emirates',
    locale: 'en-AE',
    defaultRatePerUSD: 3.67,
    decimals: 2,
  },
  SGD: {
    code: 'SGD',
    symbol: 'S$',
    name: 'Singapore Dollar',
    region: 'Singapore',
    locale: 'en-SG',
    defaultRatePerUSD: 1.34,
    decimals: 2,
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    region: 'Japan',
    locale: 'ja-JP',
    defaultRatePerUSD: 154,
    decimals: 0,
  },
  BRL: {
    code: 'BRL',
    symbol: 'R$',
    name: 'Brazilian Real',
    region: 'Brazil',
    locale: 'pt-BR',
    defaultRatePerUSD: 5.78,
    decimals: 2,
  },
};

export const CURRENCY_LIST: CurrencyMeta[] = Object.values(CURRENCY_CATALOG);

export const DEFAULT_RATES_PER_USD: Record<LocalCurrencyCode, number> = Object.fromEntries(
  CURRENCY_LIST.map((c) => [c.code, c.defaultRatePerUSD])
) as Record<LocalCurrencyCode, number>;

let activeRatesPerUSD: Record<LocalCurrencyCode, number> = { ...DEFAULT_RATES_PER_USD };

export function setLiveFxRates(rates: Partial<Record<string, number>> | undefined): void {
  if (!rates) return;
  for (const code of Object.keys(CURRENCY_CATALOG) as LocalCurrencyCode[]) {
    const val = rates[code];
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      activeRatesPerUSD[code] = val;
    }
  }
}

export function getActiveFxRates(): Record<LocalCurrencyCode, number> {
  return { ...activeRatesPerUSD };
}

export function getFxRatePerUsd(
  code: LocalCurrencyCode,
  ratesOverride?: Partial<Record<LocalCurrencyCode, number>>
): number {
  if (code === 'USD') return 1;
  const val = ratesOverride?.[code] ?? activeRatesPerUSD[code] ?? CURRENCY_CATALOG[code]?.defaultRatePerUSD;
  return typeof val === 'number' && val > 0 ? val : 1;
}

export function isSupportedCurrency(code: string | undefined | null): code is LocalCurrencyCode {
  if (!code) return false;
  return code.toUpperCase() in CURRENCY_CATALOG;
}

export function formatUsdPrice(
  usd: number,
  options?: { forceDecimals?: boolean }
): string {
  const abs = Math.abs(usd);
  const hasCents = Math.abs(usd - Math.round(usd)) > 0.004;
  const useTwoDecimals = Boolean(options?.forceDecimals) || (abs > 0 && abs < 1) || hasCents;
  const formatted = usd.toLocaleString('en-US', {
    minimumFractionDigits: useTwoDecimals ? 2 : 0,
    maximumFractionDigits: useTwoDecimals ? 2 : 0,
  });
  return `US$${formatted}`;
}

export function formatCurrencyFromUsd(
  usd: number,
  currency: LocalCurrencyCode,
  ratesOverride?: Partial<Record<LocalCurrencyCode, number>>,
  options?: { compactWholeUnits?: boolean }
): string {
  if (currency === 'USD') {
    return formatUsdPrice(usd, {
      forceDecimals: options?.compactWholeUnits ? false : undefined,
    });
  }
  const meta = CURRENCY_CATALOG[currency] || CURRENCY_CATALOG.USD;
  const rate = getFxRatePerUsd(currency, ratesOverride);
  const converted = usd * rate;
  const isSmall = Math.abs(converted) > 0 && Math.abs(converted) < 10;
  const decimals = isSmall ? 2 : meta.decimals;
  const rounded = decimals === 0 ? Math.round(converted) : Number(converted.toFixed(decimals));
  const formatted = rounded.toLocaleString(meta.locale, {
    minimumFractionDigits: decimals === 0 ? 0 : isSmall || Math.abs(rounded - Math.round(rounded)) > 0.004 ? 2 : 0,
    maximumFractionDigits: decimals,
  });
  return `${meta.symbol}${formatted}`;
}

export function formatLocalRateBanner(
  currency: LocalCurrencyCode,
  ratesOverride?: Partial<Record<LocalCurrencyCode, number>>
): string {
  if (currency === 'USD') return '1 US$ = US$1.00 USD';
  const meta = CURRENCY_CATALOG[currency] || CURRENCY_CATALOG.ZAR;
  const rate = getFxRatePerUsd(currency, ratesOverride);
  const formatted = rate.toLocaleString(meta.locale, {
    minimumFractionDigits: rate >= 100 ? 0 : 2,
    maximumFractionDigits: rate >= 100 ? 0 : 2,
  });
  return `1 US$ = ${meta.symbol}${formatted} ${meta.code}`;
}

export function detectCurrencyFromCoords(
  lat: number,
  lng: number
): { currency: LocalCurrencyCode; locationLabel: string } | null {
  // South Africa (Johannesburg, Cape Town, Durban, Pretoria)
  if (lat >= -35.5 && lat <= -22 && lng >= 16 && lng <= 33.5) {
    return { currency: 'ZAR', locationLabel: 'South Africa' };
  }
  // Nigeria
  if (lat >= 4 && lat <= 14 && lng >= 2.5 && lng <= 15) {
    return { currency: 'NGN', locationLabel: 'Nigeria' };
  }
  // Kenya
  if (lat >= -5 && lat <= 5 && lng >= 33.5 && lng <= 42) {
    return { currency: 'KES', locationLabel: 'Kenya' };
  }
  // United Kingdom
  if (lat >= 49.5 && lat <= 61 && lng >= -8.5 && lng <= 2) {
    return { currency: 'GBP', locationLabel: 'United Kingdom' };
  }
  // Eurozone (broad continental EU band)
  if (lat >= 35 && lat <= 70 && lng >= -10 && lng <= 25) {
    return { currency: 'EUR', locationLabel: 'Europe' };
  }
  // UAE
  if (lat >= 22 && lat <= 26.5 && lng >= 51 && lng <= 56.5) {
    return { currency: 'AED', locationLabel: 'UAE' };
  }
  // India
  if (lat >= 6 && lat <= 36 && lng >= 68 && lng <= 98) {
    return { currency: 'INR', locationLabel: 'India' };
  }
  // Singapore
  if (lat >= 1.1 && lat <= 1.55 && lng >= 103.5 && lng <= 104.2) {
    return { currency: 'SGD', locationLabel: 'Singapore' };
  }
  // Japan
  if (lat >= 24 && lat <= 46 && lng >= 122 && lng <= 146) {
    return { currency: 'JPY', locationLabel: 'Japan' };
  }
  // Australia
  if (lat >= -44 && lat <= -10 && lng >= 112 && lng <= 154) {
    return { currency: 'AUD', locationLabel: 'Australia' };
  }
  // Brazil
  if (lat >= -34 && lat <= 5.5 && lng >= -74 && lng <= -34) {
    return { currency: 'BRL', locationLabel: 'Brazil' };
  }
  // Canada
  if (lat >= 49 && lat <= 83 && lng >= -141 && lng <= -52) {
    return { currency: 'CAD', locationLabel: 'Canada' };
  }
  // United States
  if (lat >= 24 && lat < 49 && lng >= -126 && lng <= -66) {
    return { currency: 'USD', locationLabel: 'United States' };
  }
  return null;
}

const COUNTRY_TO_CURRENCY: Record<string, { currency: LocalCurrencyCode; label: string }> = {
  US: { currency: 'USD', label: 'United States' },
  ZA: { currency: 'ZAR', label: 'South Africa' },
  GB: { currency: 'GBP', label: 'United Kingdom' },
  UK: { currency: 'GBP', label: 'United Kingdom' },
  NG: { currency: 'NGN', label: 'Nigeria' },
  KE: { currency: 'KES', label: 'Kenya' },
  CA: { currency: 'CAD', label: 'Canada' },
  AU: { currency: 'AUD', label: 'Australia' },
  IN: { currency: 'INR', label: 'India' },
  AE: { currency: 'AED', label: 'UAE' },
  SG: { currency: 'SGD', label: 'Singapore' },
  JP: { currency: 'JPY', label: 'Japan' },
  BR: { currency: 'BRL', label: 'Brazil' },
  DE: { currency: 'EUR', label: 'Germany' },
  FR: { currency: 'EUR', label: 'France' },
  NL: { currency: 'EUR', label: 'Netherlands' },
  ES: { currency: 'EUR', label: 'Spain' },
  IT: { currency: 'EUR', label: 'Italy' },
  IE: { currency: 'EUR', label: 'Ireland' },
  PT: { currency: 'EUR', label: 'Portugal' },
  BE: { currency: 'EUR', label: 'Belgium' },
  AT: { currency: 'EUR', label: 'Austria' },
  FI: { currency: 'EUR', label: 'Finland' },
};

export function detectCurrencyFromCountryCode(
  countryCode: string | undefined | null
): { currency: LocalCurrencyCode; locationLabel: string } | null {
  if (!countryCode) return null;
  const hit = COUNTRY_TO_CURRENCY[countryCode.trim().toUpperCase()];
  return hit ? { currency: hit.currency, locationLabel: hit.label } : null;
}

export function detectCurrencyFromBrowser(): {
  currency: LocalCurrencyCode;
  locationLabel: string;
  isFallback?: boolean;
} {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const tzLower = tz.toLowerCase();
    if (tzLower.includes('johannesburg') || tzLower.includes('maseru') || tzLower.includes('mbabane')) {
      return { currency: 'ZAR', locationLabel: 'South Africa' };
    }
    if (tzLower.includes('lagos')) return { currency: 'NGN', locationLabel: 'Nigeria' };
    if (tzLower.includes('nairobi')) return { currency: 'KES', locationLabel: 'Kenya' };
    if (tzLower.includes('london')) return { currency: 'GBP', locationLabel: 'United Kingdom' };
    if (tzLower.includes('dubai')) return { currency: 'AED', locationLabel: 'UAE' };
    if (tzLower.includes('kolkata') || tzLower.includes('calcutta')) {
      return { currency: 'INR', locationLabel: 'India' };
    }
    if (tzLower.includes('singapore')) return { currency: 'SGD', locationLabel: 'Singapore' };
    if (tzLower.includes('tokyo')) return { currency: 'JPY', locationLabel: 'Japan' };
    if (tzLower.includes('sao_paulo')) return { currency: 'BRL', locationLabel: 'Brazil' };
    if (tzLower.startsWith('australia/')) return { currency: 'AUD', locationLabel: 'Australia' };
    if (
      tzLower.includes('toronto') ||
      tzLower.includes('vancouver') ||
      tzLower.includes('montreal') ||
      tzLower.includes('edmonton')
    ) {
      return { currency: 'CAD', locationLabel: 'Canada' };
    }
    if (
      tzLower.startsWith('europe/') &&
      !tzLower.includes('london') &&
      !tzLower.includes('zurich')
    ) {
      return { currency: 'EUR', locationLabel: 'Europe' };
    }
    if (tzLower.startsWith('america/')) {
      return { currency: 'USD', locationLabel: 'United States' };
    }

    const lang = (typeof navigator !== 'undefined' ? navigator.language : '') || '';
    const parts = lang.split('-');
    if (parts.length >= 2) {
      const byCountry = detectCurrencyFromCountryCode(parts[parts.length - 1]);
      if (byCountry) return byCountry;
    }
  } catch {
    // ignore browser Intl failures
  }

  return { currency: 'USD', locationLabel: 'Global (US$)', isFallback: true };
}
