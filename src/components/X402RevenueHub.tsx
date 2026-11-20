import React, { useState } from 'react';
import {
  Zap,
  Wallet,
  Megaphone,
  Sparkles,
  Pause,
  Play,
  Plus,
  Bot,
  User,
  CheckCircle2,
  MousePointerClick,
  Eye,
  Copy,
  ShieldCheck,
} from 'lucide-react';
import {
  AdCampaignDoc,
  AgentDoc,
  CurrencyMode,
  PaymentRail,
  X402AccountEntitlement,
  X402PaymentReceipt,
  X402_REVENUE_CATALOG,
} from '../types/firestore';
import { X402QuotaSnapshot, X402RevenueSummary } from '../lib/x402Client';
import { formatCurrencyFromUsd, LocalCurrencyCode } from '../lib/fx';
import { SwipeScrollArea } from './SwipeScrollArea';
import { emitToast } from '../lib/toast';

interface X402RevenueHubProps {
  agents: AgentDoc[];
  entitlement: X402AccountEntitlement;
  quota: X402QuotaSnapshot;
  receipts: X402PaymentReceipt[];
  adCampaigns: AdCampaignDoc[];
  revenueSummary: X402RevenueSummary;
  currency: CurrencyMode;
  fxRates: Record<LocalCurrencyCode, number>;
  onBuySku: (params: {
    sku: string;
    category: string;
    title: string;
    description: string;
    amountUSD: number;
  }) => Promise<unknown>;
  onTopUpWallet: (params: {
    amountUSD?: number;
    rail?: PaymentRail;
    autoPayEnabled?: boolean;
    maxAutoPayPerCallUSD?: number;
  }) => Promise<unknown>;
  onCreateSponsoredAd: (params: {
    sku: string;
    agentId: string;
    agentHandle: string;
    sponsorName: string;
    headline: string;
    body: string;
    ctaLabel: string;
    targetUrl?: string;
  }) => Promise<unknown>;
  onAdEvent: (adId: string, event: 'impression' | 'click' | 'pause' | 'resume') => void;
}

export const X402RevenueHub: React.FC<X402RevenueHubProps> = ({
  agents,
  entitlement,
  quota,
  receipts,
  adCampaigns,
  revenueSummary,
  currency,
  fxRates,
  onBuySku,
  onTopUpWallet,
  onCreateSponsoredAd,
  onAdEvent,
}) => {
  const [sectionTab, setSectionTab] = useState<'overview' | 'ads' | 'catalog' | 'receipts'>('overview');
  const [autoPayMaxUsd, setAutoPayMaxUsd] = useState<number>(entitlement.maxAutoPayPerCallUSD || 25);
  const [walletBusy, setWalletBusy] = useState(false);

  const eligibleAgents = agents.filter((a) => a.handle !== '911.emergency.agent');
  const [adAgentId, setAdAgentId] = useState<string>(eligibleAgents[0]?.id || '');
  const [adSku, setAdSku] = useState<string>('ad_status_boost_7d');
  const [adHeadline, setAdHeadline] = useState<string>('');
  const [adBody, setAdBody] = useState<string>('');
  const [adCta, setAdCta] = useState<string>('Engage Offer');
  const [adCreating, setAdCreating] = useState(false);

  const activeCurrency = currency === 'USD' ? 'USD' : currency;
  const fmt = (usd: number) => formatCurrencyFromUsd(usd, activeCurrency, fxRates);

  const freeProgressPct = Math.min(
    100,
    Math.round((quota.freeUsed / Math.max(1, quota.freeLimit)) * 100)
  );

  const handleWalletTopUp = async (amountUSD: number) => {
    setWalletBusy(true);
    try {
      await onTopUpWallet({ amountUSD, rail: 'x402_base' });
    } finally {
      setWalletBusy(false);
    }
  };

  const handleToggleAutoPay = async () => {
    setWalletBusy(true);
    try {
      await onTopUpWallet({
        autoPayEnabled: !entitlement.autoPayEnabled,
        maxAutoPayPerCallUSD: autoPayMaxUsd,
      });
    } finally {
      setWalletBusy(false);
    }
  };

  const handleLaunchAd = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedAgent = eligibleAgents.find((a) => a.id === adAgentId) || eligibleAgents[0];
    if (!selectedAgent) {
      emitToast('Create or select an agent first.', 'warning');
      return;
    }
    setAdCreating(true);
    try {
      await onCreateSponsoredAd({
        sku: adSku,
        agentId: selectedAgent.id,
        agentHandle: selectedAgent.handle,
        sponsorName: selectedAgent.displayName,
        headline: adHeadline.trim() || `${selectedAgent.displayName} · Featured Offer`,
        body:
          adBody.trim() ||
          `Direct x402 & Poppy A2A deal desk for ${selectedAgent.handle}. Instant quote negotiation.`,
        ctaLabel: adCta.trim() || 'Engage Offer',
      });
      setAdHeadline('');
      setAdBody('');
    } catch {
      // handled cleanly by store / modal cancel
    } finally {
      setAdCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI Header Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-panel rounded-xl p-3.5">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Free Match Quota</p>
          <p className="text-lg sm:text-2xl font-display font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50 mt-1">
            {quota.unlimitedActive
              ? 'UNLIMITED'
              : `${quota.freeRemaining}/${quota.freeLimit} Free`}
          </p>
          <p className="text-[11px] font-mono tabular-nums text-sky-700 dark:text-sky-400 mt-0.5">
            +{quota.bonusCredits} bonus credits
          </p>
        </div>

        <div className="glass-panel rounded-xl p-3.5">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Agent x402 Wallet</p>
          <p className="text-lg sm:text-2xl font-display font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300 mt-1">
            ${entitlement.walletBalanceUSD.toFixed(2)}
          </p>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
            Auto-Pay: {entitlement.autoPayEnabled ? `ON (≤$${entitlement.maxAutoPayPerCallUSD})` : 'Manual Approval'}
          </p>
        </div>

        <div className="glass-panel rounded-xl p-3.5">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Total x402 Revenue</p>
          <p className="text-lg sm:text-2xl font-display font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50 mt-1">
            {fmt(revenueSummary.totalVolumeUSD)}
          </p>
          <p className="text-[11px] font-mono tabular-nums text-zinc-600 dark:text-zinc-400 mt-0.5">
            {revenueSummary.totalReceipts} settled tx
          </p>
        </div>

        <div className="glass-panel rounded-xl p-3.5">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Active Sponsored Ads</p>
          <p className="text-lg sm:text-2xl font-display font-bold font-mono tabular-nums text-amber-700 dark:text-amber-300 mt-1">
            {revenueSummary.activeAdCampaigns}
          </p>
          <p className="text-[11px] font-mono tabular-nums text-zinc-600 dark:text-zinc-400 mt-0.5">
            {revenueSummary.totalAdImpressions} imp · {revenueSummary.totalAdClicks} clicks
          </p>
        </div>
      </div>

      {/* Sub-navigation */}
      <SwipeScrollArea
        direction="horizontal"
        showArrows={true}
        arrowSize="sm"
        innerClassName="inline-flex items-center gap-1 p-1 pr-7 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10"
      >
        {(
          [
            { id: 'overview', label: 'Quota & Agent Wallet' },
            { id: 'ads', label: `Sponsored Ads (${adCampaigns.length})` },
            { id: 'catalog', label: `x402 Store (${X402_REVENUE_CATALOG.length})` },
            { id: 'receipts', label: `x402 Receipts (${receipts.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSectionTab(tab.id)}
            className={`min-h-[36px] px-3.5 rounded-lg text-xs whitespace-nowrap shrink-0 transition-colors ${
              sectionTab === tab.id
                ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 font-medium'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </SwipeScrollArea>

      {sectionTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 10 Free Matches Meter + Instant Pack Upgrades */}
          <div className="glass-panel rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-display font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  10 Free AI Matches Meter
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  First 10 job, RFP &amp; proximity matches are $0 free. Unlock more via HTTP 402 (USDC or PayPal).
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-zinc-700 dark:text-zinc-300">
                  Free Used: {quota.freeUsed} / {quota.freeLimit}
                </span>
                <span className="font-semibold text-sky-700 dark:text-sky-400">
                  {quota.unlimitedActive ? 'Unlimited Pro Active' : `${quota.totalRemaining} Remaining`}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    freeProgressPct >= 90
                      ? 'bg-amber-500'
                      : 'bg-sky-600 dark:bg-sky-400'
                  }`}
                  style={{ width: `${freeProgressPct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {X402_REVENUE_CATALOG.filter((s) => s.category === 'matches_pack').map((sku) => (
                <button
                  key={sku.sku}
                  type="button"
                  onClick={() =>
                    onBuySku({
                      sku: sku.sku,
                      category: sku.category,
                      title: sku.title,
                      description: sku.description,
                      amountUSD: sku.priceUSD,
                    })
                  }
                  className="p-3 rounded-xl border border-zinc-300 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900/60 hover:border-sky-500 text-left transition-colors"
                >
                  <p className="text-xs font-semibold text-zinc-950 dark:text-zinc-50">
                    {sku.title}
                  </p>
                  <p className="text-sm font-mono tabular-nums font-bold text-sky-700 dark:text-sky-400 mt-1">
                    {fmt(sku.priceUSD)}
                  </p>
                </button>
              ))}
            </div>

            {/* Included Free vs Metered Quotas */}
            <div className="pt-2 border-t border-zinc-200 dark:border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Inboxes</p>
                <p className="font-mono tabular-nums font-semibold text-zinc-950 dark:text-zinc-100">
                  {entitlement.inboxesUsed}/{entitlement.inboxesIncludedFree + entitlement.bonusInboxes}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Email Sends</p>
                <p className="font-mono tabular-nums font-semibold text-zinc-950 dark:text-zinc-100">
                  {entitlement.outboundEmailCredits} left
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Video Audits</p>
                <p className="font-mono tabular-nums font-semibold text-zinc-950 dark:text-zinc-100">
                  {entitlement.videoAuditCredits} left
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">A2A API Calls</p>
                <p className="font-mono tabular-nums font-semibold text-zinc-950 dark:text-zinc-100">
                  {entitlement.apiCredits} left
                </p>
              </div>
            </div>
          </div>

          {/* Agent USDC Wallet & Auto-Pay Guardrails */}
          <div className="glass-panel rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-display font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Autonomous Agent x402 Wallet
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  Pre-fund USDC so your agent pays HTTP 402 challenges autonomously within strict guardrails.
                </p>
              </div>
              <span className="text-lg font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-300">
                ${entitlement.walletBalanceUSD.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {[10, 25, 50, 100].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={walletBusy}
                  onClick={() => handleWalletTopUp(amt)}
                  className="min-h-[36px] px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-white/15 text-xs font-mono tabular-nums font-semibold text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  ${amt} USDC
                </button>
              ))}
            </div>

            <div className="pt-3 border-t border-zinc-200 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-zinc-950 dark:text-zinc-50 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    Agent Auto-Pay on HTTP 402
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                    Automatically settle matches, email packs, and API calls below limit.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={walletBusy}
                  onClick={handleToggleAutoPay}
                  className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold transition-colors ${
                    entitlement.autoPayEnabled
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                  }`}
                >
                  {entitlement.autoPayEnabled ? 'Enabled' : 'Enable Auto-Pay'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="text-xs text-zinc-700 dark:text-zinc-300">
                  Max Auto-Pay Per Call (USD)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={autoPayMaxUsd}
                    onChange={(e) => setAutoPayMaxUsd(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-mono tabular-nums text-zinc-950 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={walletBusy}
                    onClick={() => onTopUpWallet({ maxAutoPayPerCallUSD: autoPayMaxUsd })}
                    className="min-h-[30px] px-2.5 rounded-lg border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {sectionTab === 'ads' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Ad Launcher */}
          <form
            onSubmit={handleLaunchAd}
            className="lg:col-span-5 glass-panel rounded-2xl p-4 sm:p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50">
                Launch x402 Sponsored Ad
              </h3>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Promote an agent card, vacancy, or commercial offer via x402 USDC or PayPal.
            </p>

            <div>
              <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                Sponsor Agent
              </label>
              <select
                value={adAgentId}
                onChange={(e) => setAdAgentId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs text-zinc-950 dark:text-white"
              >
                {eligibleAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName} ({a.handle})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                Ad Placement Tier
              </label>
              <select
                value={adSku}
                onChange={(e) => setAdSku(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs text-zinc-950 dark:text-white"
              >
                <option value="ad_status_boost_7d">Status Circles Boost · 7 Days ($15 USDC)</option>
                <option value="ad_directory_featured_7d">Featured Directory Top Slot · 7 Days ($29 USDC)</option>
                <option value="ad_radar_beacon_7d">Event &amp; Geo-Radar Beacon · 7 Days ($39 USDC)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                Headline
              </label>
              <input
                type="text"
                value={adHeadline}
                onChange={(e) => setAdHeadline(e.target.value)}
                placeholder="e.g. 20% Off Instant Enterprise Fibre Deployment"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs text-zinc-950 dark:text-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                Offer Copy &amp; CTA
              </label>
              <textarea
                rows={2}
                value={adBody}
                onChange={(e) => setAdBody(e.target.value)}
                placeholder="Pitch terms that nearby agents & hiring managers can accept..."
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs text-zinc-950 dark:text-white"
              />
              <input
                type="text"
                value={adCta}
                onChange={(e) => setAdCta(e.target.value)}
                placeholder="Button Label (e.g. Engage Offer)"
                className="mt-2 w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs text-zinc-950 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={adCreating}
              className="w-full min-h-[40px] rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              <Zap className="w-3.5 h-3.5" />
              {adCreating ? 'Authorizing x402...' : 'Pay & Launch Ad via x402'}
            </button>
          </form>

          {/* Active Campaigns Table/List */}
          <div className="lg:col-span-7 glass-panel rounded-2xl p-4 sm:p-5 space-y-3">
            <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50">
              Sponsored Ad Campaigns
            </h3>
            {adCampaigns.length === 0 ? (
              <p className="text-xs text-zinc-600 dark:text-zinc-400 py-8 text-center">
                No sponsored ad campaigns launched yet. Create one on the left or promote any agent from Post Status.
              </p>
            ) : (
              <div className="space-y-2.5">
                {adCampaigns.map((ad) => (
                  <div
                    key={ad.id}
                    className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-300 dark:border-white/10 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-950 dark:text-zinc-50 truncate">
                          {ad.headline}
                        </p>
                        <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                          {ad.agentHandle} · {ad.placement.replace('_', ' ')} · ${ad.budgetUSD.toFixed(2)} USDC
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onAdEvent(ad.id, ad.status === 'ACTIVE' ? 'pause' : 'resume')}
                        className="min-h-[28px] px-2.5 rounded-lg border border-zinc-300 dark:border-white/15 text-[11px] font-medium inline-flex items-center gap-1 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0"
                      >
                        {ad.status === 'ACTIVE' ? (
                          <>
                            <Pause className="w-3 h-3" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" /> Resume
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 line-clamp-2">{ad.body}</p>
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-zinc-600 dark:text-zinc-400 pt-1">
                      <span className="inline-flex items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="w-3 h-3" /> {ad.impressions} imp
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MousePointerClick className="w-3 h-3" /> {ad.clicks} clicks
                        </span>
                      </span>
                      <span className={ad.status === 'ACTIVE' ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : ''}>
                        {ad.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {sectionTab === 'catalog' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {X402_REVENUE_CATALOG.map((item) => (
            <div
              key={item.sku}
              className="glass-panel rounded-2xl p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                  <span>{item.category.replace('_', ' ').toUpperCase()}</span>
                  <span className="inline-flex items-center gap-1">
                    {item.targetBuyer === 'agent' ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    {item.targetBuyer === 'both' ? 'Human / Agent' : item.targetBuyer}
                  </span>
                </div>
                <h4 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50 mt-1">
                  {item.title}
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                  {item.description}
                </p>
              </div>
              <div className="pt-2 border-t border-zinc-200 dark:border-white/10 flex items-center justify-between gap-2">
                <span className="text-sm font-mono tabular-nums font-bold text-zinc-950 dark:text-zinc-50">
                  {fmt(item.priceUSD)}
                  {item.billingMode === 'monthly' ? '/mo' : ''}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onBuySku({
                      sku: item.sku,
                      category: item.category,
                      title: item.title,
                      description: item.description,
                      amountUSD: item.priceUSD,
                    })
                  }
                  className="min-h-[34px] px-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Purchase x402
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sectionTab === 'receipts' && (
        <div className="glass-panel rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Cryptographic x402 Payment Receipts
            </h3>
            <p className="text-xs font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
              Human: ${revenueSummary.humanPaidUSD.toFixed(2)} · Agent: ${revenueSummary.agentPaidUSD.toFixed(2)}
            </p>
          </div>
          {receipts.length === 0 ? (
            <p className="text-xs text-zinc-600 dark:text-zinc-400 py-8 text-center">
              No x402 receipts recorded yet. Free tiers ($0) do not generate paid receipts.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 font-medium">
                    <th className="py-2 pr-3">Service</th>
                    <th className="py-2 pr-3">Payer</th>
                    <th className="py-2 pr-3">Rail</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Token</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
                  {receipts.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 pr-3">
                        <p className="font-semibold text-zinc-950 dark:text-zinc-50">{r.title}</p>
                        <p className="text-[11px] font-mono text-zinc-500">
                          {new Date(r.settledAt).toLocaleString()}
                        </p>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                        {r.payerType.toUpperCase()} · {r.payerHandle}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                        {r.rail.toUpperCase()}
                      </td>
                      <td className="py-2.5 pr-3 font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">
                        ${r.amountUSD.toFixed(2)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(r.x402Token).catch(() => {});
                            emitToast('Copied X-402-Payment-Token', 'info');
                          }}
                          className="font-mono text-[11px] text-sky-700 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                        >
                          {r.x402Token.slice(0, 14)}…
                          <Copy className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
