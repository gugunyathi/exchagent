import React, { useState } from 'react';
import {
  Search,
  Gavel,
  ShieldAlert,
  ArrowRightLeft,
  Trophy,
  CheckCircle2,
} from 'lucide-react';
import {
  AgentHandleDoc,
  AuctionDoc,
  SecondaryListingDoc,
  CurrencyMode,
  ZAR_PER_USD,
} from '../types/firestore';
import { quoteHandlePricing } from '../services/paymentRails';
import { SwipeScrollArea } from './SwipeScrollArea';

interface RegistryMarketplaceModuleProps {
  claimedHandles: AgentHandleDoc[];
  auctions: AuctionDoc[];
  secondaryListings: SecondaryListingDoc[];
  currency: CurrencyMode;
  ownerUid: string;
  ownerName: string;
  onClaimHandle: (record: AgentHandleDoc) => void;
  onPlaceBid: (auctionId: string, amountUSD: number, bidderHandle: string) => void;
  onBuyoutListing: (listingId: string, buyerHandle: string) => AgentHandleDoc | null;
}

const SLIDING_SCALE_ROWS = [
  { tier: '1-Character / 1-Digit', humanUSD: 1000, botUSD: 1000, note: 'Genesis vanity (e.g. x.agent, 1.agent)' },
  { tier: '2-Character / 2-Digit', humanUSD: 500, botUSD: 500, note: 'Ultra-short handle (e.g. ai.agent, 88.agent)' },
  { tier: '3-Character', humanUSD: 200, botUSD: 200, note: 'Executive ticker (e.g. pay.agent, mtn.agent)' },
  { tier: '4-Character', humanUSD: 50, botUSD: 50, note: 'Studio & startup tier' },
  { tier: '5–6 Characters', humanUSD: 10, botUSD: 10, note: 'Growth brand namespace' },
  { tier: '7+ Characters', humanUSD: 0, botUSD: 0.2, note: 'Free for verified humans · $0.20 USDC x402 for bots' },
];

export const RegistryMarketplaceModule: React.FC<RegistryMarketplaceModuleProps> = ({
  claimedHandles,
  auctions,
  secondaryListings,
  currency,
  ownerUid,
  ownerName,
  onClaimHandle,
  onPlaceBid,
  onBuyoutListing,
}) => {
  const [subTab, setSubTab] = useState<'search' | 'auctions' | 'marketplace' | 'leaderboard'>('search');
  const [queryInput, setQueryInput] = useState('');
  const [buyerType, setBuyerType] = useState<'human' | 'bot'>('human');
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [bidAmountById, setBidAmountById] = useState<Record<string, number>>({});
  const [marketMessage, setMarketMessage] = useState<string | null>(null);

  const quote = quoteHandlePricing(queryInput || 'switchboard');
  const existingClaim = claimedHandles.find((h) => h.handle === quote.normalizedHandle);
  const existingAuction = auctions.find((a) => a.handle === quote.normalizedHandle);
  const existingListing = secondaryListings.find(
    (l) => l.handle === quote.normalizedHandle && l.status === 'AVAILABLE'
  );

  const formatUSDOrZAR = (usd: number) => {
    if (currency === 'ZAR') {
      return `R${Math.round(usd * ZAR_PER_USD).toLocaleString('en-ZA')}`;
    }
    return `$${usd.toLocaleString('en-US', { minimumFractionDigits: usd < 1 && usd > 0 ? 2 : 0 })}`;
  };

  const handleClaim = async () => {
    if (!queryInput.trim()) return;
    if (quote.isProtectedCivic || quote.isAuctionRequired || existingClaim) return;

    const priceUSD = buyerType === 'bot' ? quote.botX402PriceUSD : quote.humanPriceUSD;
    const record: AgentHandleDoc = {
      id: `h_${Date.now()}`,
      handle: quote.normalizedHandle,
      category: quote.charLength <= 6 ? 'short_handle' : 'standard',
      charLength: quote.charLength,
      ownerUid,
      ownerDisplayName: ownerName,
      tierPriceUSD: priceUSD,
      paidVia: buyerType === 'bot' || priceUSD > 0 ? 'x402_usdc' : 'free_human',
      status: 'ACTIVE',
      claimedAt: new Date().toISOString(),
    };
    onClaimHandle(record);
    setClaimMessage(
      `Claimed ${record.handle} via ${
        record.paidVia === 'free_human' ? 'Verified Human Free Tier' : `x402 USDC (${formatUSDOrZAR(priceUSD)})`
      }.`
    );
  };

  // Compute Owners Leaderboard
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
    <div className="space-y-4 sm:space-y-5">
      {/* Header & Tabs */}
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-cyan-400">
            .agent Registry · Shortcodes &amp; Auctions
          </p>
          <h2 className="text-base sm:text-lg font-semibold text-white mt-0.5">
            Handles &amp; Brand Marketplace
          </h2>
        </div>

        <SwipeScrollArea direction="horizontal" className="w-full lg:w-auto" innerClassName="flex items-center gap-1 p-1 rounded-xl bg-slate-950/70 border border-slate-800">
          {(
            [
              { id: 'search', label: 'Search & Pricing' },
              { id: 'auctions', label: `Auctions (${auctions.length})` },
              { id: 'marketplace', label: `Secondary (${secondaryListings.filter((l) => l.status === 'AVAILABLE').length})` },
              { id: 'leaderboard', label: 'Leaderboard' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                subTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </SwipeScrollArea>
      </div>

      {subTab === 'search' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
          {/* Search & Instant Quote */}
          <div className="lg:col-span-7 glass-panel rounded-2xl p-3.5 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-white">Search .agent Handle or Shortcode</h3>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950/70 border border-slate-800">
                <button
                  onClick={() => setBuyerType('human')}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${
                    buyerType === 'human' ? 'bg-slate-800 text-white' : 'text-slate-400'
                  }`}
                >
                  Human
                </button>
                <button
                  onClick={() => setBuyerType('bot')}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${
                    buyerType === 'bot' ? 'bg-slate-800 text-amber-300' : 'text-slate-400'
                  }`}
                >
                  Bot (x402)
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={queryInput}
                onChange={(e) => {
                  setQueryInput(e.target.value);
                  setClaimMessage(null);
                }}
                placeholder="Try: 911, 007, coke, ai, sandton.solar..."
                className="w-full min-h-[44px] rounded-xl bg-slate-950/80 border border-slate-800 pl-10 pr-4 py-2.5 text-sm font-mono text-cyan-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Live Availability Result */}
            <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3.5 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-base sm:text-lg font-mono font-semibold text-white truncate">
                    {quote.normalizedHandle}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {quote.charLength} characters · {quote.tierLabel}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs text-slate-500">Registration Fee</p>
                  <p className="text-base sm:text-lg font-mono tabular-nums font-semibold text-emerald-300">
                    {quote.isProtectedCivic
                      ? 'PROTECTED'
                      : buyerType === 'bot'
                      ? formatUSDOrZAR(quote.botX402PriceUSD)
                      : quote.humanPriceUSD === 0
                      ? 'FREE (Human)'
                      : formatUSDOrZAR(quote.humanPriceUSD)}
                  </p>
                </div>
              </div>

              {quote.isProtectedCivic ? (
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-200 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>
                    Locked by Public Safety Mandate (911, 999, 112, 10111, 10177). Connects free to Emergency Dispatch.
                  </span>
                </div>
              ) : existingAuction ? (
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80">
                  <span className="text-xs text-amber-300">
                    Active English Auction · Current Bid {formatUSDOrZAR(existingAuction.currentBidUSD)}
                  </span>
                  <button
                    onClick={() => setSubTab('auctions')}
                    className="min-h-[40px] rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 whitespace-nowrap"
                  >
                    Bid in Auction
                  </button>
                </div>
              ) : existingListing ? (
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80">
                  <span className="text-xs text-cyan-300">
                    Listed on Secondary Market · Buyout {formatUSDOrZAR(existingListing.buyoutPriceUSD)}
                  </span>
                  <button
                    onClick={() => setSubTab('marketplace')}
                    className="min-h-[40px] rounded-xl bg-cyan-400 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 whitespace-nowrap"
                  >
                    View Listing
                  </button>
                </div>
              ) : existingClaim ? (
                <p className="text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                  Already claimed by <span className="text-white">{existingClaim.ownerDisplayName}</span>.
                </p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80">
                  <span className="text-xs text-emerald-400">
                    Available for instant registration
                  </span>
                  <button
                    onClick={handleClaim}
                    className="min-h-[42px] rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300 whitespace-nowrap"
                  >
                    {buyerType === 'bot' ? 'Pay x402 & Claim' : 'Claim .agent Handle'}
                  </button>
                </div>
              )}

              {claimMessage && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{claimMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* Sliding-Scale Pricing Table */}
          <div className="lg:col-span-5 glass-panel rounded-2xl p-3.5 sm:p-5 space-y-3">
            <h3 className="text-sm sm:text-base font-semibold text-white">Sliding-Scale Registration Tiers</h3>
            <div className="divide-y divide-slate-800/80 text-xs">
              {SLIDING_SCALE_ROWS.map((row) => (
                <div key={row.tier} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-200">{row.tier}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{row.note}</p>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-cyan-300 shrink-0">
                    {row.humanUSD === 0 ? `FREE / $0.20` : formatUSDOrZAR(row.humanUSD)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subTab === 'auctions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {auctions.map((auc) => {
            const minNextBid = auc.currentBidUSD + 100;
            const bidVal = bidAmountById[auc.id] ?? minNextBid;
            return (
              <div key={auc.id} className="glass-panel rounded-2xl p-3.5 sm:p-5 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span className="font-mono text-amber-300">
                    {auc.kind === 'iconic_number' ? 'Iconic Shortcode Auction' : 'Enterprise Brand Auction'}
                  </span>
                  <span className="font-mono tabular-nums">
                    Ends {new Date(auc.endsAt).toLocaleDateString('en-ZA')}
                  </span>
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl font-mono font-bold text-white truncate">{auc.handle}</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{auc.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-xs">
                  <div>
                    <p className="text-slate-500">Current Highest Bid</p>
                    <p className="text-base sm:text-lg font-mono tabular-nums font-semibold text-emerald-300 mt-0.5">
                      {formatUSDOrZAR(auc.currentBidUSD)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-500">Leading Handle ({auc.bidsCount} bids)</p>
                    <p className="text-xs font-mono text-cyan-300 mt-1.5 truncate">
                      {auc.highestBidderHandle}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
                  <input
                    type="number"
                    min={minNextBid}
                    step={50}
                    value={bidVal}
                    onChange={(e) =>
                      setBidAmountById((prev) => ({ ...prev, [auc.id]: Number(e.target.value) }))
                    }
                    className="w-full sm:w-32 min-h-[42px] rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm font-mono tabular-nums text-white"
                  />
                  <button
                    onClick={() => onPlaceBid(auc.id, Math.max(minNextBid, bidVal), 'alex.founder.agent')}
                    className="flex-1 min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap"
                  >
                    <Gavel className="w-3.5 h-3.5" />
                    Place Bid ({formatUSDOrZAR(Math.max(minNextBid, bidVal))})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {subTab === 'marketplace' && (
        <div className="space-y-4">
          {marketMessage && (
            <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/30 p-3.5 text-xs text-emerald-200">
              {marketMessage}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {secondaryListings.map((item) => (
              <div key={item.id} className="glass-panel rounded-2xl p-3.5 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{item.category}</span>
                  <span className="font-mono text-emerald-400">{item.status}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl sm:text-2xl font-mono font-bold text-white truncate">{item.handle}</h3>
                  <p className="text-xs text-slate-400 mt-1 truncate">
                    Seller: <span className="font-mono text-cyan-300">{item.sellerHandle}</span>
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-slate-500">Instant Buyout</p>
                    <p className="text-base font-mono tabular-nums font-semibold text-white">
                      {formatUSDOrZAR(item.buyoutPriceUSD)}
                    </p>
                  </div>
                  <button
                    disabled={item.status !== 'AVAILABLE'}
                    onClick={() => {
                      const bought = onBuyoutListing(item.id, ownerName);
                      if (bought) {
                        setMarketMessage(
                          `Instant P2P Buyout complete! ${bought.handle} transferred to ${ownerName} via x402 escrow.`
                        );
                      }
                    }}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 whitespace-nowrap"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    {item.status === 'AVAILABLE' ? 'Instant Buyout' : 'Sold'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'leaderboard' && (
        <div className="glass-panel rounded-2xl p-3.5 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm sm:text-base font-semibold text-white">Verified .agent Portfolio Leaderboard</h3>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden space-y-2.5">
            {leaderboard.map((row, idx) => (
              <div
                key={row.owner}
                className="rounded-xl bg-slate-950/75 border border-slate-800 p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[11px] font-mono text-amber-300 mr-1.5">#{idx + 1}</span>
                    <span className="text-xs font-semibold text-white truncate">{row.owner}</span>
                  </div>
                  <span className="font-mono tabular-nums text-xs font-semibold text-emerald-300 shrink-0">
                    {formatUSDOrZAR(row.totalValueUSD)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {row.count} {row.count === 1 ? 'handle' : 'handles'} ·{' '}
                  <span className="font-mono text-cyan-300">{row.handles.join(', ')}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <table className="hidden md:table w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 pr-4 font-medium">Owner / Entity</th>
                <th className="py-2.5 px-4 font-medium">Handles Owned</th>
                <th className="py-2.5 px-4 font-medium">Portfolio</th>
                <th className="py-2.5 pl-4 font-medium text-right">Registry Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {leaderboard.map((row) => (
                <tr key={row.owner} className="hover:bg-slate-900/40">
                  <td className="py-3 pr-4 font-medium text-white">{row.owner}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-300">{row.count}</td>
                  <td className="py-3 px-4 font-mono text-cyan-300">{row.handles.join(', ')}</td>
                  <td className="py-3 pl-4 font-mono tabular-nums font-semibold text-emerald-300 text-right">
                    {formatUSDOrZAR(row.totalValueUSD)}
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
