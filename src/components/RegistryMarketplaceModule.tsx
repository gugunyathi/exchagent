import React, { useState } from 'react';
import {
  Search,
  Gavel,
  ShieldAlert,
  ArrowRightLeft,
  Trophy,
  ChevronDown,
  ChevronUp,
  Globe,
  LocateFixed,
} from 'lucide-react';
import {
  AgentHandleDoc,
  AuctionDoc,
  SecondaryListingDoc,
  CurrencyMode,
  X402AccountEntitlement,
} from '../types/firestore';
import { X402SettleResult, x402FetchWithAutoPay } from '../lib/x402Client';
import {
  CURRENCY_LIST,
  LocalCurrencyCode,
  formatCurrencyFromUsd,
  formatLocalRateBanner,
  formatUsdPrice,
} from '../lib/fx';
import {
  quoteHandlePricing,
  generateRandomAgentHandle,
  HandleEntityType,
  HandleBillingCycle,
} from '../services/paymentRails';
import { SwipeScrollArea } from './SwipeScrollArea';
import { emitToast } from '../lib/toast';

interface RegistryMarketplaceModuleProps {
  claimedHandles: AgentHandleDoc[];
  auctions: AuctionDoc[];
  secondaryListings: SecondaryListingDoc[];
  currency: CurrencyMode;
  localCurrency: LocalCurrencyCode;
  locationLabel: string;
  fxRates: Record<LocalCurrencyCode, number>;
  fxSource: 'live' | 'reference';
  detectingLocation: boolean;
  ownerUid: string;
  ownerName: string;
  x402Entitlement?: X402AccountEntitlement;
  onX402Settled?: (result: X402SettleResult) => void;
  onSelectCurrency: (currency: CurrencyMode) => void;
  onSelectLocalCurrency: (currency: LocalCurrencyCode) => void;
  onDetectLocation: () => void;
  onClaimHandle: (record: AgentHandleDoc) => void;
  onPlaceBid: (auctionId: string, amountUSD: number, bidderHandle: string) => void;
  onBuyoutListing: (listingId: string, buyerHandle: string) => AgentHandleDoc | null;
}

interface RegistryTierRow {
  tier: string;
  priceDisplay: string;
  usdValue: number;
  suffix: string;
  note: string;
}

const SLIDING_SCALE_ROWS: RegistryTierRow[] = [
  {
    tier: 'Random Assigned Name (Personal or Business)',
    priceDisplay: 'FREE ($0)',
    usdValue: 0,
    suffix: '',
    note: 'System-assigned name (personalagent1643.agent, businessagent1761.agent)',
  },
  {
    tier: 'Personal Custom Name (5+ Chars)',
    priceDisplay: '$2/mo · $20/yr min',
    usdValue: 2,
    suffix: '/mo (or $20/yr)',
    note: 'Minimum custom personal registration fee',
  },
  {
    tier: 'Business Custom Name (5+ Chars)',
    priceDisplay: '$10/mo · $100/yr base',
    usdValue: 10,
    suffix: '/mo (or $100/yr)',
    note: 'Base custom business & hiring desk registration',
  },
  {
    tier: '4-Character Unique Domain',
    priceDisplay: '$50 one-time',
    usdValue: 50,
    suffix: ' one-time',
    note: 'Separate one-time domain name purchase',
  },
  {
    tier: '3-Character Unique Domain',
    priceDisplay: '$200 one-time',
    usdValue: 200,
    suffix: ' one-time',
    note: 'Separate one-time domain name purchase',
  },
  {
    tier: '2-Character Unique Domain',
    priceDisplay: '$500 one-time',
    usdValue: 500,
    suffix: ' one-time',
    note: 'Separate one-time domain name purchase',
  },
  {
    tier: '1-Character / 1-Digit Domain',
    priceDisplay: '$1,000 one-time',
    usdValue: 1000,
    suffix: ' one-time',
    note: 'Separate flagship domain name purchase',
  },
  {
    tier: 'Unique Name Auctions (1–100, 007, Brands)',
    priceDisplay: '$800 – $1,500+ one-time',
    usdValue: 800,
    suffix: '+ one-time',
    note: 'Auction prices are a separate domain name purchase',
  },
];

export const RegistryMarketplaceModule: React.FC<RegistryMarketplaceModuleProps> = ({
  claimedHandles,
  auctions,
  secondaryListings,
  currency,
  localCurrency,
  locationLabel,
  fxRates,
  fxSource,
  detectingLocation,
  ownerUid,
  ownerName,
  onSelectCurrency,
  onSelectLocalCurrency,
  onDetectLocation,
  onClaimHandle,
  onPlaceBid,
  onBuyoutListing,
  x402Entitlement,
  onX402Settled,
}) => {
  const [subTab, setSubTab] = useState<'search' | 'auctions' | 'marketplace' | 'leaderboard'>('search');
  const [queryInput, setQueryInput] = useState('');
  const [buyerType, setBuyerType] = useState<'human' | 'bot'>('human');
  const [entityType, setEntityType] = useState<HandleEntityType>('personal');
  const [billingCycle, setBillingCycle] = useState<HandleBillingCycle>('monthly');
  const [tiersExpanded, setTiersExpanded] = useState(true);
  const [bidAmountById, setBidAmountById] = useState<Record<string, number>>({});
  const [claimingHandle, setClaimingHandle] = useState(false);

  const defaultPreviewInput = entityType === 'business' ? 'businessagent1761' : 'personalagent1643';
  const quote = quoteHandlePricing(queryInput || defaultPreviewInput, { entityType, billingCycle });
  const existingClaim = claimedHandles.find((h) => h.handle === quote.normalizedHandle);
  const existingAuction = auctions.find((a) => a.handle === quote.normalizedHandle);
  const existingListing = secondaryListings.find(
    (l) => l.handle === quote.normalizedHandle && l.status === 'AVAILABLE'
  );

  const effectiveLocal: LocalCurrencyCode = localCurrency === 'USD' ? 'ZAR' : localCurrency;

  const formatPrimaryPrice = (usd: number) =>
    formatCurrencyFromUsd(usd, currency, fxRates, { compactWholeUnits: true });

  const formatSecondaryEquiv = (usd: number): string | null => {
    if (usd <= 0) return null;
    if (currency === 'USD') {
      if (localCurrency === 'USD') return null;
      return `≈ ${formatCurrencyFromUsd(usd, localCurrency, fxRates)} ${localCurrency}`;
    }
    return `(${formatUsdPrice(usd)})`;
  };

  const handleClaim = async () => {
    const targetHandleInput = queryInput.trim() || defaultPreviewInput;
    if (quote.isProtectedCivic || quote.isAuctionRequired || existingClaim || claimingHandle) return;

    setClaimingHandle(true);
    try {
      const claimRes = await x402FetchWithAutoPay(
        '/api/names/claim',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            handle: targetHandleInput,
            buyerType,
            entityType,
            billingCycle,
            ownerUid,
            ownerName,
          }),
        },
        {
          entitlement: x402Entitlement,
          payerHandle: ownerName || 'alex.founder.agent',
          ownerUid,
          onSettled: onX402Settled,
        }
      );

      if (!claimRes.ok) {
        const errBody = await claimRes.json().catch(() => ({}));
        emitToast(errBody?.error || 'Payment required to register custom .agent domain.', 'warning');
        return;
      }

      const data = await claimRes.json();
      const priceUSD = quote.isSystemRandom
        ? 0
        : buyerType === 'bot'
        ? quote.botX402PriceUSD
        : quote.humanPriceUSD;
      const record: AgentHandleDoc = {
        id: `h_${Date.now()}`,
        handle: data.handle || quoteHandlePricing(targetHandleInput, { entityType, billingCycle }).normalizedHandle,
        category: quote.charLength <= 4 ? 'short_handle' : 'standard',
        charLength: quote.charLength,
        entityType: quote.entityType,
        billingCycle: quote.isSystemRandom
          ? 'free_random'
          : quote.isSeparateDomainPurchase
          ? 'one_time'
          : billingCycle,
        ownerUid,
        ownerDisplayName: ownerName,
        tierPriceUSD: priceUSD,
        paidVia: quote.isSystemRandom
          ? 'free_random'
          : data?.receipt?.rail === 'paypal_vault'
          ? 'paypal_vault'
          : 'x402_usdc',
        status: 'ACTIVE',
        claimedAt: new Date().toISOString(),
      };
      onClaimHandle(record);
      const cycleSuffix =
        quote.isSystemRandom
          ? 'Free System Handle'
          : quote.isSeparateDomainPurchase
          ? `${formatPrimaryPrice(priceUSD)} one-time domain`
          : `${formatPrimaryPrice(priceUSD)}${billingCycle === 'annual' ? '/yr' : '/mo'}`;
      emitToast(`Claimed ${record.handle} (${cycleSuffix})`, 'success');
    } finally {
      setClaimingHandle(false);
    }
  };

  const ownerMap: Record<string, { owner: string; count: number; totalValueUSD: number; handles: string[] }> = {};
  for (const h of claimedHandles) {
    if (h.status === 'RESERVED_PROTECTED') continue;
    const key = h.ownerDisplayName;
    if (!ownerMap[key]) {
      ownerMap[key] = { owner: key, count: 0, totalValueUSD: 0, handles: [] };
    }
    ownerMap[key].count += 1;
    ownerMap[key].totalValueUSD += h.tierPriceUSD;
    ownerMap[key].handles.push(h.handle);
  }
  const leaderboard = Object.values(ownerMap).sort((a, b) => b.totalValueUSD - a.totalValueUSD);

  return (
    <div className="space-y-4">
      {/* Header & Sub-Navigation */}
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-display font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
              .agent Registry
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Shortcodes, auctions &amp; verified handle ownership · Base currency US$
            </p>
          </div>

          <SwipeScrollArea
            direction="horizontal"
            showArrows={true}
            arrowSize="sm"
            className="w-full lg:w-auto"
            innerClassName="inline-flex items-center gap-1 p-1 pr-7 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10"
          >
            {(
              [
                { id: 'search', label: 'Search' },
                { id: 'auctions', label: `Auctions (${auctions.length})` },
                { id: 'marketplace', label: `Secondary (${secondaryListings.filter((l) => l.status === 'AVAILABLE').length})` },
                { id: 'leaderboard', label: 'Leaderboard' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={`min-h-[36px] px-3.5 rounded-lg text-xs transition-colors whitespace-nowrap shrink-0 ${
                  subTab === tab.id
                    ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 font-medium'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </SwipeScrollArea>
        </div>

        {/* Location & Live FX Rate Bar */}
        <div className="pt-2.5 border-t border-zinc-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-medium">
              <Globe className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>{locationLabel}</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 font-mono text-[11px] tabular-nums text-zinc-800 dark:text-zinc-200">
              {formatLocalRateBanner(effectiveLocal, fxRates)}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                fxSource === 'live'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                  : 'bg-zinc-100 text-zinc-600 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-white/10'
              }`}
            >
              {fxSource === 'live' ? 'Live FX' : 'Ref FX'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10">
              <button
                type="button"
                onClick={() => onSelectCurrency('USD')}
                className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                  currency === 'USD'
                    ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                US$
              </button>
              <button
                type="button"
                onClick={() => onSelectCurrency(effectiveLocal)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                  currency === effectiveLocal
                    ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                {effectiveLocal}
              </button>
            </div>

            <select
              aria-label="Local Currency"
              value={currency === 'USD' ? localCurrency : currency}
              onChange={(e) => {
                const chosen = e.target.value as LocalCurrencyCode;
                onSelectLocalCurrency(chosen);
                if (currency !== 'USD') {
                  onSelectCurrency(chosen);
                }
              }}
              className="w-full sm:w-auto max-w-full min-w-0 min-h-[30px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2 text-[11px] font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-sky-600"
            >
              {CURRENCY_LIST.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol.trim()}) · {c.region}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onDetectLocation}
              disabled={detectingLocation}
              className="min-h-[30px] inline-flex items-center gap-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              title="Detect local currency from GPS location"
            >
              <LocateFixed className="w-3 h-3 text-sky-600 dark:text-sky-400" />
              <span>{detectingLocation ? 'Locating...' : 'Detect'}</span>
            </button>
          </div>
        </div>
      </div>

      {subTab === 'search' && (
        <div className="max-w-3xl mx-auto space-y-3.5">
          {/* Raycast/Spotlight-style Handle Search Bar */}
          <div className="glass-panel rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Search .agent Handle</span>
                <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setEntityType('personal')}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      entityType === 'personal'
                        ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 font-medium'
                    }`}
                  >
                    Personal ($2/mo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntityType('business')}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      entityType === 'business'
                        ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 font-medium'
                    }`}
                  >
                    Business ($10/mo)
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      billingCycle === 'monthly'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white border border-zinc-300 dark:border-white/15 font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 font-medium'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('annual')}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      billingCycle === 'annual'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white border border-zinc-300 dark:border-white/15 font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 font-medium'
                    }`}
                  >
                    Annual
                  </button>
                </div>

                <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setBuyerType('human')}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      buyerType === 'human'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white border border-zinc-300 dark:border-white/15 font-semibold shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 font-medium'
                    }`}
                  >
                    Human
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuyerType('bot')}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      buyerType === 'bot'
                        ? 'bg-white dark:bg-zinc-800 text-amber-700 dark:text-amber-300 border border-zinc-300 dark:border-white/15 font-semibold shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 font-medium'
                    }`}
                  >
                    Bot (x402)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 dark:text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="Type custom name (alex.founder, acme) or leave empty for free random name..."
                  className="w-full min-h-[46px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 pl-10 pr-4 text-sm font-mono text-zinc-950 dark:text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
                />
              </div>
              <button
                type="button"
                onClick={() => setQueryInput(generateRandomAgentHandle(entityType))}
                className="min-h-[46px] px-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:border-zinc-500 whitespace-nowrap shrink-0"
              >
                Assign Free Random ($0)
              </button>
            </div>

            {/* Instant Quote & 1-Click Action */}
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-base sm:text-lg font-mono font-bold text-zinc-950 dark:text-zinc-50 truncate">
                    {quote.normalizedHandle}
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 tabular-nums">
                    {quote.charLength} chars · {quote.tierLabel}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {quote.billingNote}
                  </p>
                </div>
                <div className="sm:text-right shrink-0">
                  <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    {quote.isSeparateDomainPurchase
                      ? 'Separate Domain Purchase'
                      : quote.isSystemRandom
                      ? 'System-Assigned Name'
                      : 'Name Registration Fee'}
                  </p>
                  <p className="text-base sm:text-lg font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-300">
                    {quote.isProtectedCivic
                      ? 'PROTECTED'
                      : quote.isSystemRandom
                      ? 'FREE ($0)'
                      : quote.isSeparateDomainPurchase
                      ? `${formatPrimaryPrice(quote.oneTimeDomainUSD)} one-time`
                      : `${formatPrimaryPrice(quote.humanPriceUSD)}${billingCycle === 'annual' ? '/yr' : '/mo'}`}
                  </p>
                  {!quote.isProtectedCivic &&
                    !quote.isSystemRandom &&
                    formatSecondaryEquiv(
                      quote.isSeparateDomainPurchase ? quote.oneTimeDomainUSD : quote.humanPriceUSD
                    ) && (
                      <p className="text-[11px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatSecondaryEquiv(
                          quote.isSeparateDomainPurchase ? quote.oneTimeDomainUSD : quote.humanPriceUSD
                        )}
                        {!quote.isSeparateDomainPurchase && (billingCycle === 'annual' ? '/yr' : '/mo')}
                      </p>
                    )}
                </div>
              </div>

              {quote.isProtectedCivic ? (
                <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-500/30 p-2.5 text-xs font-medium text-rose-800 dark:text-rose-200 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>Reserved civic emergency line (911, 999, 112, 10111, 10177).</span>
                </div>
              ) : existingAuction ? (
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-zinc-200 dark:border-white/10">
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 tabular-nums">
                    English Auction · Top Bid {formatPrimaryPrice(existingAuction.currentBidUSD)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSubTab('auctions')}
                    className="min-h-[38px] rounded-lg bg-amber-500 hover:bg-amber-600 dark:bg-amber-400 dark:hover:bg-amber-300 px-3.5 text-xs font-semibold text-white dark:text-zinc-950 whitespace-nowrap"
                  >
                    Bid in Auction
                  </button>
                </div>
              ) : existingListing ? (
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-zinc-200 dark:border-white/10">
                  <span className="text-xs font-semibold text-sky-700 dark:text-sky-400 tabular-nums">
                    Secondary Listing · {formatPrimaryPrice(existingListing.buyoutPriceUSD)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSubTab('marketplace')}
                    className="min-h-[38px] rounded-lg bg-zinc-950 dark:bg-zinc-50 px-3.5 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white whitespace-nowrap"
                  >
                    View Listing
                  </button>
                </div>
              ) : existingClaim ? (
                <p className="text-xs text-zinc-600 dark:text-zinc-400 pt-2 border-t border-zinc-200 dark:border-white/10">
                  Owned by <span className="text-zinc-950 dark:text-zinc-100 font-semibold">{existingClaim.ownerDisplayName}</span>.
                </p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-zinc-200 dark:border-white/10">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Available now</span>
                  <button
                    type="button"
                    onClick={handleClaim}
                    className="min-h-[38px] rounded-lg bg-zinc-950 dark:bg-zinc-50 px-4 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white whitespace-nowrap"
                  >
                    {buyerType === 'bot' ? 'Pay x402 & Claim' : 'Claim Handle'}
                  </button>
                </div>
              )}
            </div>

            {/* Collapsible Sliding-Scale Pricing Tiers */}
            <button
              type="button"
              onClick={() => setTiersExpanded((v) => !v)}
              className="w-full min-h-[38px] rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-300 dark:border-white/15 px-3.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:text-white flex items-center justify-between"
            >
              <span>Sliding-Scale Pricing Tiers (US$ + {effectiveLocal} Local FX)</span>
              {tiersExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {tiersExpanded && (
              <div className="divide-y divide-zinc-200 dark:divide-white/10 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 px-3.5">
                {SLIDING_SCALE_ROWS.map((row) => {
                  const localEquiv = formatSecondaryEquiv(row.usdValue);
                  return (
                    <div key={row.tier} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-200">{row.tier}</p>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">{row.note}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono tabular-nums font-semibold text-zinc-950 dark:text-zinc-100 block">
                          {row.usdValue === 0
                            ? 'FREE ($0)'
                            : currency === 'USD'
                            ? row.priceDisplay
                            : `${formatPrimaryPrice(row.usdValue)}${row.suffix}`}
                        </span>
                        {localEquiv && row.usdValue > 0 && (
                          <span className="font-mono tabular-nums text-[10.5px] text-zinc-500 dark:text-zinc-400 block">
                            {localEquiv}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'auctions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {auctions.map((auc) => {
            const minNextBid = auc.currentBidUSD + 100;
            const bidVal = bidAmountById[auc.id] ?? minNextBid;
            const localTop = formatSecondaryEquiv(auc.currentBidUSD);
            return (
              <div key={auc.id} className="glass-panel rounded-2xl p-4 space-y-3 min-w-0">
                <div className="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="font-mono font-semibold text-amber-700 dark:text-amber-300">
                    {auc.kind === 'iconic_number' ? 'Shortcode Auction' : 'Brand Auction'}
                  </span>
                  <span className="font-mono tabular-nums">
                    Ends {new Date(auc.endsAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="min-w-0">
                  <h3 className="text-xl font-mono font-bold text-zinc-950 dark:text-zinc-50 truncate">{auc.handle}</h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{auc.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-200 dark:border-white/10 text-xs">
                  <div>
                    <p className="text-zinc-500 dark:text-zinc-400">Top Bid</p>
                    <p className="text-base font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {formatPrimaryPrice(auc.currentBidUSD)}
                    </p>
                    {localTop && (
                      <p className="text-[11px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                        {localTop}
                      </p>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-zinc-500 dark:text-zinc-400 tabular-nums">Leader ({auc.bidsCount} bids)</p>
                    <p className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-200 mt-1 truncate">
                      {auc.highestBidderHandle}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <div className="relative w-full sm:w-36">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-zinc-500">
                      US$
                    </span>
                    <input
                      type="number"
                      min={minNextBid}
                      step={50}
                      value={bidVal}
                      onChange={(e) =>
                        setBidAmountById((prev) => ({ ...prev, [auc.id]: Number(e.target.value) }))
                      }
                      className="w-full min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 pl-9 pr-3 text-xs font-mono tabular-nums text-zinc-950 dark:text-white focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextAmount = Math.max(minNextBid, bidVal);
                      onPlaceBid(auc.id, nextAmount, 'alex.founder.agent');
                      emitToast(`Bid placed: ${formatPrimaryPrice(nextAmount)} on ${auc.handle}`, 'success');
                    }}
                    className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-950 dark:bg-zinc-50 px-4 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white whitespace-nowrap transition-colors"
                  >
                    <Gavel className="w-3.5 h-3.5" />
                    Place Bid ({formatPrimaryPrice(Math.max(minNextBid, bidVal))})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {subTab === 'marketplace' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {secondaryListings.map((item) => {
            const localBuyout = formatSecondaryEquiv(item.buyoutPriceUSD);
            return (
              <div key={item.id} className="glass-panel rounded-2xl p-4 space-y-3 min-w-0">
                <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                  <span>{item.category}</span>
                  <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">{item.status}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-mono font-bold text-zinc-950 dark:text-zinc-50 truncate">{item.handle}</h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 truncate">
                    Seller: <span className="font-mono font-medium text-zinc-900 dark:text-zinc-200">{item.sellerHandle}</span>
                  </p>
                </div>
                <div className="pt-2.5 border-t border-zinc-200 dark:border-white/10 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Buyout</p>
                    <p className="text-base font-mono tabular-nums font-bold text-zinc-950 dark:text-zinc-50">
                      {formatPrimaryPrice(item.buyoutPriceUSD)}
                    </p>
                    {localBuyout && (
                      <p className="text-[10.5px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                        {localBuyout}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={item.status !== 'AVAILABLE' || claimingHandle}
                    onClick={async () => {
                      setClaimingHandle(true);
                      try {
                        const buyRes = await x402FetchWithAutoPay(
                          '/api/names/buyout',
                          {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              listingId: item.id,
                              buyerUid: ownerUid,
                              buyerName: ownerName,
                            }),
                          },
                          {
                            entitlement: x402Entitlement,
                            payerHandle: ownerName || 'alex.founder.agent',
                            ownerUid,
                            onSettled: onX402Settled,
                          }
                        );
                        if (!buyRes.ok) {
                          const errBody = await buyRes.json().catch(() => ({}));
                          emitToast(errBody?.error || 'x402 escrow payment required for buyout.', 'warning');
                          return;
                        }
                        const bought = onBuyoutListing(item.id, ownerName);
                        if (bought) {
                          emitToast(`Bought ${bought.handle} via x402 escrow`, 'success');
                        }
                      } finally {
                        setClaimingHandle(false);
                      }
                    }}
                    className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 dark:bg-zinc-50 px-3.5 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-40 whitespace-nowrap transition-colors"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    {item.status === 'AVAILABLE' ? 'Buyout' : 'Sold'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {subTab === 'leaderboard' && (
        <div className="glass-panel rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50">Portfolio Leaderboard</h3>
          </div>

          <div className="md:hidden space-y-2">
            {leaderboard.map((row, idx) => (
              <div key={row.owner} className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[11px] font-mono text-zinc-500 mr-1.5 tabular-nums">#{idx + 1}</span>
                    <span className="text-xs font-semibold text-zinc-950 dark:text-zinc-100 truncate">{row.owner}</span>
                  </div>
                  <span className="font-mono tabular-nums text-xs font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                    {formatPrimaryPrice(row.totalValueUSD)}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
                  {row.count} {row.count === 1 ? 'handle' : 'handles'} ·{' '}
                  <span className="font-mono text-zinc-800 dark:text-zinc-300">{row.handles.join(', ')}</span>
                </p>
              </div>
            ))}
          </div>

          <table className="hidden md:table w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-300 dark:border-white/10 text-zinc-600 dark:text-zinc-400">
                <th className="py-2 pr-4 font-semibold">Owner</th>
                <th className="py-2 px-4 font-semibold">Count</th>
                <th className="py-2 px-4 font-semibold">Handles</th>
                <th className="py-2 pl-4 font-semibold text-right">Portfolio Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
              {leaderboard.map((row) => (
                <tr key={row.owner} className="hover:bg-zinc-100/70 dark:hover:bg-zinc-900/50">
                  <td className="py-2.5 pr-4 font-semibold text-zinc-950 dark:text-zinc-100">{row.owner}</td>
                  <td className="py-2.5 px-4 font-mono tabular-nums text-zinc-600 dark:text-zinc-400">{row.count}</td>
                  <td className="py-2.5 px-4 font-mono text-zinc-800 dark:text-zinc-300">{row.handles.join(', ')}</td>
                  <td className="py-2.5 pl-4 font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-300 text-right">
                    {formatPrimaryPrice(row.totalValueUSD)}
                    {formatSecondaryEquiv(row.totalValueUSD) && (
                      <span className="block text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                        {formatSecondaryEquiv(row.totalValueUSD)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
