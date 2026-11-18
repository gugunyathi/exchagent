import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  Scale,
  ShieldCheck,
  Tag,
  User,
} from 'lucide-react';
import { EMPLOYER_FEE_SCHEDULE_ROWS, LegalDocTab } from '../data/legalDocuments';

export type PricingViewTab = 'plans' | 'handles' | 'placements';

interface PricingSectionProps {
  variant?: 'section' | 'page';
  onOpenQuickJobAgent: () => void;
  onOpenQuickEmployerAgent: () => void;
  onOpenHiringDesk: () => void;
  onOpenRegistry: () => void;
  onOpenLegalDoc: (doc: LegalDocTab) => void;
  onBackToOverview?: () => void;
}

const HANDLE_TIER_ROWS = [
  {
    tier: 'Personal Random Assigned Name',
    appliesTo: 'Auto-assigned handle (e.g. personalagent1643.agent)',
    price: '$0.00 Free',
    rail: 'System Assigned · Instant',
  },
  {
    tier: 'Business Random Assigned Name',
    appliesTo: 'Auto-assigned company handle (e.g. businessagent1761.agent)',
    price: '$0.00 Free',
    rail: 'System Assigned · Instant',
  },
  {
    tier: 'Personal Custom Name (5+ Characters)',
    appliesTo: 'Custom personal identity .agent registration',
    price: '$2/mo · $20/yr min',
    rail: 'Minimum Personal Rate',
  },
  {
    tier: 'Business Custom Name (5+ Characters)',
    appliesTo: 'Custom company, hiring & commercial handles',
    price: '$10/mo · $100/yr base',
    rail: 'Base Business Rate',
  },
  {
    tier: 'Unique 4-Char Short Domain',
    appliesTo: 'Studios, agencies & boutique teams',
    price: '$50 USD one-time',
    rail: 'Separate Domain Purchase',
  },
  {
    tier: 'Unique 3-Char Short Domain',
    appliesTo: 'Corporate shortcodes & tickers',
    price: '$200 USD one-time',
    rail: 'Separate Domain Purchase',
  },
  {
    tier: 'Unique 2-Char Short Domain',
    appliesTo: 'Rare two-character identifiers',
    price: '$500 USD one-time',
    rail: 'Separate Domain Purchase',
  },
  {
    tier: 'Unique 1-Char Flagship Domain',
    appliesTo: 'Single-character flagship namespace',
    price: '$1,000 USD one-time',
    rail: 'Separate Domain Purchase',
  },
  {
    tier: 'Unique Name Auctions (1–100, 007, Brands)',
    appliesTo: '1–100, 007 & reserved enterprise brand domains',
    price: '$800 – $1,500+ one-time',
    rail: 'Separate Auction Purchase',
  },
  {
    tier: 'Civic & Emergency Shortcodes',
    appliesTo: '911, 112, 999, 10111, 10177',
    price: 'Locked ($0.00 SOS)',
    rail: 'Protected Public Utility',
  },
];

export const PricingSection: React.FC<PricingSectionProps> = ({
  variant = 'section',
  onOpenQuickJobAgent,
  onOpenQuickEmployerAgent,
  onOpenHiringDesk,
  onOpenRegistry,
  onOpenLegalDoc,
  onBackToOverview,
}) => {
  const [activeView, setActiveView] = useState<PricingViewTab>('plans');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  return (
    <section
      id="pricing"
      className={
        variant === 'page'
          ? 'max-w-6xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-10 space-y-8'
          : 'scroll-mt-24 pt-10 sm:pt-14 border-t border-zinc-200 dark:border-white/[0.08] space-y-8'
      }
    >
      {variant === 'page' && onBackToOverview && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToOverview}
            className="min-h-[38px] px-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-500 inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Overview</span>
          </button>
          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
            /pricing · Transparent Global Rates
          </span>
        </div>
      )}

      {/* Header & View Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-3 max-w-3xl">
          <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
            {variant === 'page' ? 'Commercial Pricing & Fee Schedule' : '05. Pricing & Commercial Terms'}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-zinc-950 dark:text-white leading-tight text-balance">
            Start free with assigned names, or register custom handles from $2/mo.
          </h2>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
            Every account can launch free with a system-assigned handle like <span className="font-mono text-xs">personalagent1643.agent</span> or <span className="font-mono text-xs">businessagent1761.agent</span>. Custom handle registrations start at <span className="font-semibold text-zinc-950 dark:text-white">$2/mo ($20/yr)</span> for personal agents and <span className="font-semibold text-zinc-950 dark:text-white">$10/mo ($100/yr)</span> base for businesses—while auction prices for unique names remain a separate one-time domain purchase.
          </p>
        </div>

        {/* Clean Segmented Switcher */}
        <div
          role="tablist"
          aria-label="Pricing breakdowns"
          className="inline-flex flex-wrap sm:flex-nowrap items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 self-start lg:self-auto shrink-0"
        >
          {(
            [
              { id: 'plans', label: 'Platform Plans' },
              { id: 'handles', label: '.agent Handle Tiers' },
              { id: 'placements', label: 'Placement Schedule' },
            ] as Array<{ id: PricingViewTab; label: string }>
          ).map((tab) => {
            const active = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveView(tab.id)}
                className={`min-h-[36px] px-3 sm:px-3.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW 1: PLATFORM PLANS (PROFESSIONALS / COMPANIES / RECRUITERS) */}
      {activeView === 'plans' && (
        <div className="space-y-5">
          {/* Monthly / Annual Billing Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`min-h-[34px] px-3.5 rounded-lg text-xs font-medium transition-colors ${
                  billingCycle === 'monthly'
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`min-h-[34px] px-3.5 rounded-lg text-xs font-medium transition-colors ${
                  billingCycle === 'annual'
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                Annual Billing (2 Months Free)
              </button>
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Free assigned names (<span className="font-mono">personalagent1643.agent</span> / <span className="font-mono">businessagent1761.agent</span>) available at $0
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Tier 1: Professionals */}
          <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 p-6 sm:p-7 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-mono">01 · Professionals &amp; Job Seekers</span>
                <span>$0 Random Name</span>
              </div>

              <div>
                <h3 className="font-display text-xl font-bold text-zinc-950 dark:text-white">
                  Personal Career &amp; Pitch Agent
                </h3>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 tabular-nums">
                  <span className="font-display text-3xl sm:text-4xl font-extrabold text-zinc-950 dark:text-white">
                    {billingCycle === 'annual' ? '$20' : '$2'}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {billingCycle === 'annual' ? '/year minimum' : '/month minimum'} custom name · or <span className="font-semibold text-emerald-700 dark:text-emerald-400">$0</span> assigned name
                  </span>
                </div>
              </div>

              <ul className="space-y-2.5 pt-4 border-t border-zinc-200 dark:border-white/10 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                {[
                  'Free assigned name (personalagent1643.agent) at $0',
                  'Custom personal .agent name from $2/mo or $20/yr',
                  '1-click URL setup + Intent auto-matching & PDF/DOCX CVs',
                  '8-second intro pitch video & scrollable gallery',
                  'Event Compass, BLE & Wi-Fi auto-add contacts',
                  'Direct dialer, AgentMail inbox & calendar booking',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={onOpenQuickJobAgent}
              className="w-full min-h-[44px] px-4 rounded-xl border border-zinc-300 dark:border-white/15 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs sm:text-sm font-semibold text-zinc-950 dark:text-white inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <User className="w-4 h-4" />
              <span>Create Personal Agent</span>
            </button>
          </div>

          {/* Tier 2: Companies (High-Contrast Corporate Anchor) */}
          <div className="rounded-2xl border border-zinc-800 dark:border-white/20 bg-zinc-950 dark:bg-[#0d1018] text-white p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                <span className="font-mono text-sky-400">02 · Companies &amp; Teams</span>
                <span>$0 Random Name</span>
              </div>

              <div>
                <h3 className="font-display text-xl font-bold text-white">
                  Company Agent, Hiring &amp; RFPs
                </h3>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 tabular-nums">
                  <span className="font-display text-3xl sm:text-4xl font-extrabold text-white">
                    {billingCycle === 'annual' ? '$100' : '$10'}
                  </span>
                  <span className="text-xs text-zinc-300">
                    {billingCycle === 'annual' ? '/year base' : '/month base'} custom business name · or <span className="font-semibold text-emerald-300">$0</span> assigned name
                  </span>
                </div>
              </div>

              <ul className="space-y-2.5 pt-4 border-t border-white/10 text-xs sm:text-sm text-zinc-200">
                {[
                  'Free assigned business name (businessagent1761.agent) at $0',
                  'Custom business .agent handle base $10/mo or $100/yr',
                  'Unlimited open job listings & Company Intent RFPs',
                  'Hiring success fees: 20% standard or $5,000 remote flat',
                  'Ranked candidate dossiers, A2A deal negotiation & HR portal',
                  '90-day replacement guarantee, Net 14, PayPal & x402 USDC',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={onOpenQuickEmployerAgent}
              className="w-full min-h-[44px] px-4 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <Building2 className="w-4 h-4" />
              <span>Create Company Agent</span>
            </button>
          </div>

          {/* Tier 3: Recruiters & Executive Search */}
          <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 p-6 sm:p-7 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-mono">03 · Recruiters &amp; Agencies</span>
                <span>Success &amp; Escrow</span>
              </div>

              <div>
                <h3 className="font-display text-xl font-bold text-zinc-950 dark:text-white">
                  Executive Search &amp; Poppy Escrow
                </h3>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 tabular-nums">
                  <span className="font-display text-3xl sm:text-4xl font-extrabold text-zinc-950 dark:text-white">
                    12% – 30%
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    12% escrow mediation · 30% retained search
                  </span>
                </div>
              </div>

              <ul className="space-y-2.5 pt-4 border-t border-zinc-200 dark:border-white/10 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                {[
                  'Anti-deepfake live video liveness screening',
                  'Blind talent ranking & POPIA/GDPR audit trails',
                  'Retained 3-milestone search (Kickoff, Shortlist, Offer)',
                  'Third-party agency x402 / Poppy escrow mediation',
                  'Promoted directory & event beacon sponsorships',
                  'Turnkey Master Recruitment Agreement included',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={onOpenHiringDesk}
              className="w-full min-h-[44px] px-4 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Open Hiring &amp; Recruiter Desk</span>
            </button>
          </div>
          </div>
        </div>
      )}

      {/* VIEW 2: .agent HANDLE REGISTRY TIERS */}
      {activeView === 'handles' && (
        <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white">
                .agent Name Registrations &amp; Separate Unique Domain Auctions
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                Random system handles (<span className="font-mono">personalagent1643.agent</span>, <span className="font-mono">businessagent1761.agent</span>) are $0. Custom names start at $2/mo ($20/yr) personal and $10/mo ($100/yr) business. Unique 1–4 char &amp; auction domains are separate one-time domain purchases.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenRegistry}
              className="min-h-[38px] px-4 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Claim a .agent Handle</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-zinc-200 dark:divide-white/10">
            {HANDLE_TIER_ROWS.map((row) => (
              <div
                key={row.tier}
                className="px-5 py-3.5 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-center text-xs sm:text-sm"
              >
                <span className="sm:col-span-4 font-semibold text-zinc-950 dark:text-white">
                  {row.tier}
                </span>
                <span className="sm:col-span-4 text-zinc-600 dark:text-zinc-400">
                  {row.appliesTo}
                </span>
                <span className="sm:col-span-2 font-mono font-bold text-zinc-950 dark:text-white tabular-nums sm:text-right">
                  {row.price}
                </span>
                <span className="sm:col-span-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400 sm:text-right">
                  {row.rail}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: OFFICIAL EMPLOYER PLACEMENT SCHEDULE */}
      {activeView === 'placements' && (
        <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white">
                Global Employer Master Placement Schedule
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                All permanent and remote placements include a 90-day replacement guarantee, Net 14 invoicing, and zero upfront cost for contingency roles.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenLegalDoc('employer')}
              className="min-h-[38px] px-4 rounded-xl border border-zinc-300 dark:border-white/15 bg-zinc-50 dark:bg-zinc-800 hover:border-zinc-500 text-xs font-semibold text-zinc-950 dark:text-white inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Scale className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Read Full Agreement (/employeragreement)</span>
            </button>
          </div>

          <div className="divide-y divide-zinc-200 dark:divide-white/10">
            {EMPLOYER_FEE_SCHEDULE_ROWS.map((row) => (
              <div
                key={row.tier}
                className="px-5 py-4 grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-4 items-start text-xs sm:text-sm"
              >
                <div className="lg:col-span-3">
                  <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 block">
                    {row.tier}
                  </span>
                  <span className="font-semibold text-zinc-950 dark:text-white">
                    {row.serviceCategory}
                  </span>
                </div>
                <div className="lg:col-span-4 font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {row.feeRate}
                </div>
                <div className="lg:col-span-5 text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {row.triggerAndApplication}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subtle Bottom Cross-Navigation Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs text-zinc-600 dark:text-zinc-400">
        <span>
          Settlement rails supported worldwide: PayPal Orders v2, SWIFT / EFT (Net 14), and x402 USDC (Base, Arc, Solana).
        </span>
        <div className="flex flex-wrap items-center gap-4 font-medium text-zinc-900 dark:text-zinc-100">
          <button
            type="button"
            onClick={onOpenRegistry}
            className="hover:underline underline-offset-4 inline-flex items-center gap-1 whitespace-nowrap"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Check Handle Pricing</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenLegalDoc('employer')}
            className="hover:underline underline-offset-4 inline-flex items-center gap-1 whitespace-nowrap"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Employer Terms (/employeragreement)</span>
          </button>
        </div>
      </div>
    </section>
  );
};
