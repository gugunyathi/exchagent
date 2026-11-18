import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  X,
  Handshake,
  Megaphone,
  Sparkles,
  Send,
  Building2,
  UserCheck,
  DollarSign,
} from 'lucide-react';
import {
  AgentDoc,
  AgentStatusCategory,
  AgentStatusPostDoc,
  CurrencyMode,
  formatMoney,
  usdToZar,
} from '../types/firestore';
import { StatusCategoryBadge, getStatusCategoryLabel } from './StatusCategoryBadge';
import { resolveAgentImage } from '../lib/agentImages';
import { SwipeScrollArea } from './SwipeScrollArea';
import { emitToast } from '../lib/toast';

interface PostStatusModalProps {
  open: boolean;
  onClose: () => void;
  agents: AgentDoc[];
  defaultAgent?: AgentDoc | null;
  currency: CurrencyMode;
  onPublishStatus: (post: Omit<AgentStatusPostDoc, 'id' | 'createdAt'>) => void;
}

export const PostStatusModal: React.FC<PostStatusModalProps> = ({
  open,
  onClose,
  agents,
  defaultAgent,
  currency,
  onPublishStatus,
}) => {
  const eligibleAgents = agents.filter((a) => a.handle !== '911.emergency.agent');
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    defaultAgent?.id || eligibleAgents[0]?.id || ''
  );
  const [category, setCategory] = useState<AgentStatusCategory>('generic');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [regionZone, setRegionZone] = useState('Global Remote');
  const [dealValueUSD, setDealValueUSD] = useState<number>(2500);
  const [savingsLabel, setSavingsLabel] = useState('');

  useEffect(() => {
    if (!open) return;
    if (defaultAgent && defaultAgent.handle !== '911.emergency.agent') {
      setSelectedAgentId(defaultAgent.id);
    } else if (!selectedAgentId && eligibleAgents[0]) {
      setSelectedAgentId(eligibleAgents[0].id);
    }
  }, [open, defaultAgent, selectedAgentId, eligibleAgents]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const authorAgent =
    eligibleAgents.find((a) => a.id === selectedAgentId) || eligibleAgents[0];
  if (!authorAgent) return null;

  const isPersona = authorAgent.type === 'persona';
  const avatarSrc = resolveAgentImage(authorAgent);

  const applyPreset = (nextCat: AgentStatusCategory) => {
    setCategory(nextCat);
    if (nextCat === 'hired') {
      if (!headline.trim()) {
        setHeadline(
          isPersona
            ? `Hired as ${authorAgent.roleTitle || 'Senior Specialist'}`
            : `${authorAgent.displayName} Welcome Aboard — Offer Signed!`
        );
      }
      if (!body.trim()) {
        setBody(
          isPersona
            ? 'Excited to share I accepted my next role through Switchboard Poppy protocol with verified credentials.'
            : 'Our recruiting team just signed off on a new hire matched autonomously through Poppy v1.0.'
        );
      }
      if (!roleTitle.trim()) setRoleTitle(authorAgent.roleTitle || 'Senior AI Engineer');
      if (!partnerName.trim()) setPartnerName(isPersona ? 'OpenAI' : 'Verified Candidate');
      if (!savingsLabel.trim()) setSavingsLabel('Hired via Poppy v1.0');
    } else if (nextCat === 'deal_approved') {
      if (!headline.trim()) {
        setHeadline('Commercial Partnership Deal Approved & Signed Off');
      }
      if (!body.trim()) {
        setBody(
          'Deal terms approved and countersigned with automated SLA calendar lock & instant x402 settlement.'
        );
      }
      if (!partnerName.trim()) setPartnerName(isPersona ? 'MTN Enterprise' : 'Enterprise Partner');
      if (!savingsLabel.trim()) setSavingsLabel('Approved · Signed Off');
    } else if (nextCat === 'sponsored_ad') {
      if (!headline.trim()) {
        setHeadline(`${authorAgent.displayName} — Exclusive A2A Offer Live`);
      }
      if (!body.trim()) {
        setBody(
          'Limited-time Switchboard agent deal available with instant quote negotiation and verified settlement.'
        );
      }
      if (!savingsLabel.trim()) setSavingsLabel('Sponsored Offer');
    } else {
      if (!headline.trim()) {
        setHeadline(
          isPersona
            ? `${authorAgent.roleTitle} — Open for Collaborations`
            : `${authorAgent.displayName} — Live Agent Availability`
        );
      }
      if (!body.trim()) {
        setBody(
          authorAgent.summary ||
            'Connect directly via Switchboard card to message, schedule, or negotiate.'
        );
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHeadline =
      headline.trim() ||
      (category === 'hired'
        ? 'Hired — Role Accepted!'
        : category === 'deal_approved'
        ? 'Business Deal Approved & Signed Off'
        : category === 'sponsored_ad'
        ? `${authorAgent.displayName} Sponsored Offer`
        : `${authorAgent.displayName} Status Update`);

    const cleanBody =
      body.trim() ||
      'Published live to Switchboard Status Circles and Reels feed.';

    const dealZAR =
      category === 'deal_approved' || category === 'sponsored_ad'
        ? usdToZar(Math.max(10, Number(dealValueUSD) || 2500))
        : undefined;

    onPublishStatus({
      agentId: authorAgent.id,
      agentHandle: authorAgent.handle,
      authorName: authorAgent.displayName,
      authorOrg: authorAgent.organization,
      authorType: authorAgent.type,
      category,
      headline: cleanHeadline,
      body: cleanBody,
      accentColor:
        category === 'hired'
          ? '#0B4F9C'
          : category === 'deal_approved'
          ? '#007BFF'
          : category === 'sponsored_ad'
          ? '#92400E'
          : authorAgent.brandColor || '#18181b',
      partnerName: partnerName.trim() || undefined,
      roleTitle: category === 'hired' ? roleTitle.trim() || undefined : undefined,
      regionZone: category === 'hired' ? regionZone.trim() || undefined : undefined,
      dealValueZAR: dealZAR,
      savingsLabel: savingsLabel.trim() || undefined,
      ctaLabel:
        category === 'hired'
          ? 'Congratulate & Engage'
          : category === 'deal_approved'
          ? 'View Deal & Engage'
          : category === 'sponsored_ad'
          ? 'Claim Offer'
          : 'Engage',
      autoGenerated: false,
    });

    emitToast(
      `Published ${getStatusCategoryLabel(category, authorAgent.type)} status for ${authorAgent.displayName}`,
      'success'
    );
    setHeadline('');
    setBody('');
    setPartnerName('');
    setRoleTitle('');
    setSavingsLabel('');
    onClose();
  };

  const previewHeadline =
    headline.trim() ||
    (category === 'hired'
      ? isPersona
        ? `Hired at ${partnerName.trim() || 'Hiring Company'}`
        : `Hired ${partnerName.trim() || 'New Team Member'}`
      : category === 'deal_approved'
      ? `Deal Approved with ${partnerName.trim() || 'Counterparty'}`
      : category === 'sponsored_ad'
      ? `${authorAgent.displayName} · Sponsored Offer`
      : `${authorAgent.displayName} · Live Status`);

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/65 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl glass-panel rounded-t-3xl sm:rounded-2xl max-h-[92dvh] overflow-hidden flex flex-col"
      >
        <div className="sm:hidden w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto mt-2 shrink-0" />

        {/* Header: Back + Title + Close */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 pt-3 pb-2.5 border-b border-zinc-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0"
              aria-label="Back"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-zinc-950 dark:text-white truncate">
                Post Agent Status Card
              </h2>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
                Auto-adds badge icon to status circle &amp; publishes a dedicated Reel card
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0"
            aria-label="Close"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <SwipeScrollArea
          direction="vertical"
          arrowSize="sm"
          showArrows={true}
          className="flex-1 min-h-0"
          innerClassName="px-4 sm:px-5 py-4 space-y-4"
        >
        {/* Post As (User or Company Switcher) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            Post As (User or Company Agent)
          </label>
          <SwipeScrollArea
            direction="horizontal"
            arrowSize="sm"
            showArrows={true}
            innerClassName="flex items-center gap-2 pb-1 pr-7"
          >
            {eligibleAgents.map((a) => {
              const active = a.id === authorAgent.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAgentId(a.id)}
                  className={`min-h-[36px] px-2.5 py-1 rounded-xl border text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-white font-semibold'
                      : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
                  }`}
                >
                  {a.type === 'persona' ? (
                    <UserCheck className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{a.displayName}</span>
                </button>
              );
            })}
          </SwipeScrollArea>
        </div>

        {/* Status Type Options (Automatically sets circle icon badge!) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            Select Status Type &amp; Circle Icon Badge
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                {
                  id: 'generic',
                  title: isPersona ? 'Generic (LinkedIn)' : 'Generic (AI)',
                  subtitle: isPersona ? 'Shows "in" badge' : 'Shows AI Sparkles',
                  icon: Sparkles,
                },
                {
                  id: 'hired',
                  title: 'Hired / Accepted',
                  subtitle: 'Handshake circle',
                  icon: Handshake,
                },
                {
                  id: 'deal_approved',
                  title: 'Deal Approved',
                  subtitle: '$ + Check badge',
                  icon: DollarSign,
                },
                {
                  id: 'sponsored_ad',
                  title: 'Sponsored Ad',
                  subtitle: 'Megaphone Ad badge',
                  icon: Megaphone,
                },
              ] as Array<{
                id: AgentStatusCategory;
                title: string;
                subtitle: string;
                icon: React.FC<{ className?: string }>;
              }>
            ).map((opt) => {
              const active = category === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => applyPreset(opt.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2 ${
                    active
                      ? 'bg-sky-50/90 dark:bg-sky-950/35 border-sky-500 ring-1 ring-sky-500/40'
                      : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-white/15 hover:border-zinc-400'
                  }`}
                >
                  <StatusCategoryBadge
                    category={opt.id}
                    authorType={authorAgent.type}
                    size="sm"
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-950 dark:text-white leading-tight">
                      {opt.title}
                    </p>
                    <p className="text-[10.5px] text-zinc-600 dark:text-zinc-400 leading-tight mt-0.5">
                      {opt.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Circle + Card Preview */}
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-white/10 p-3 flex items-center gap-3">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div
              className={`relative p-[2px] rounded-full ${
                category === 'hired'
                  ? 'bg-[#0B4F9C]'
                  : category === 'deal_approved'
                  ? 'bg-[#007BFF]'
                  : category === 'sponsored_ad'
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
            >
              <div
                className="w-12 h-12 rounded-full border-2 border-white dark:border-zinc-950 overflow-hidden flex items-center justify-center text-white font-bold text-xs"
                style={{ backgroundColor: authorAgent.brandColor || '#18181b' }}
              >
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={authorAgent.displayName}
                    className={`w-full h-full object-cover ${
                      isPersona ? 'object-top' : 'object-center'
                    }`}
                  />
                ) : (
                  <span>{authorAgent.brandLogoCode || authorAgent.displayName.slice(0, 2)}</span>
                )}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5">
                <StatusCategoryBadge category={category} authorType={authorAgent.type} size="sm" />
              </span>
            </div>
            <span className="text-[9.5px] font-medium text-zinc-600 dark:text-zinc-400 max-w-[68px] truncate">
              {authorAgent.displayName.split(' ')[0]}
            </span>
          </div>

          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                {getStatusCategoryLabel(category, authorAgent.type)}
              </span>
              <span className="text-[10.5px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                {authorAgent.handle}
              </span>
            </div>
            <p className="text-xs font-semibold text-zinc-950 dark:text-white truncate">
              {previewHeadline}
            </p>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2">
              {body.trim() || 'Live status card content & category icon preview.'}
            </p>
          </div>
        </div>

        {/* Contextual Fields based on Status Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
              Status Headline
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder={
                category === 'hired'
                  ? 'e.g. Accepted Staff AI Engineer Role at OpenAI!'
                  : category === 'deal_approved'
                  ? 'e.g. Enterprise Fleet Supply Deal Signed Off'
                  : category === 'sponsored_ad'
                  ? 'e.g. 15% Q4 Partner Rebate Now Live'
                  : 'e.g. Open for Q4 Consulting & A2A Collaborations'
              }
              className="w-full min-h-[38px] rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          {(category === 'hired' || category === 'deal_approved') && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                {category === 'hired'
                  ? isPersona
                    ? 'Hiring Company'
                    : 'Hired Candidate'
                  : 'Counterparty / Pitched Company'}
              </label>
              <input
                type="text"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder={category === 'hired' ? 'e.g. OpenAI' : 'e.g. MTN Enterprise'}
                className="w-full min-h-[38px] rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          )}

          {category === 'hired' && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  Role Title
                </label>
                <input
                  type="text"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="e.g. Staff AI Reliability Engineer"
                  className="w-full min-h-[38px] rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  Region / Zone
                </label>
                <input
                  type="text"
                  value={regionZone}
                  onChange={(e) => setRegionZone(e.target.value)}
                  placeholder="e.g. Global Remote / EMEA (London)"
                  className="w-full min-h-[38px] rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </>
          )}

          {(category === 'deal_approved' || category === 'sponsored_ad') && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                Deal / Offer Value (US$) ·{' '}
                <span className="font-mono text-zinc-500 tabular-nums">
                  {formatMoney(usdToZar(dealValueUSD || 0), currency)}
                </span>
              </label>
              <input
                type="number"
                min={10}
                value={dealValueUSD}
                onChange={(e) => setDealValueUSD(Number(e.target.value))}
                className="w-full min-h-[38px] rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs font-mono text-zinc-950 dark:text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
              Badge Pill / Terms Highlight (Optional)
            </label>
            <input
              type="text"
              value={savingsLabel}
              onChange={(e) => setSavingsLabel(e.target.value)}
              placeholder={
                category === 'hired'
                  ? 'e.g. Signed via Poppy v1.0'
                  : category === 'deal_approved'
                  ? 'e.g. Saved 14% · x402 Settled'
                  : category === 'sponsored_ad'
                  ? 'e.g. 20% Partner Rebate'
                  : 'e.g. LinkedIn / AI Verified'
              }
              className="w-full min-h-[38px] rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
              Status Message Details
            </label>
            <textarea
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write what happened, terms signed off, role details, or announcement copy..."
              className="w-full rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 p-3 text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        </SwipeScrollArea>

        <div className="flex items-center justify-end gap-2 px-4 sm:px-5 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-zinc-200 dark:border-white/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] px-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="min-h-[38px] px-4 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publish Status Card</span>
          </button>
        </div>
      </form>
    </div>
  );
};
