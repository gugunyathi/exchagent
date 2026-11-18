import React, { useState } from 'react';
import { Search, X, LayoutGrid, GalleryHorizontalEnd, Users, Building2, Radio, ArrowLeft, Linkedin } from 'lucide-react';
import {
  AgentDoc,
  AgentRoleCategory,
  BookingDoc,
  CurrencyMode,
  usdToZar,
  formatMoney,
  CardBannerStyle,
  CardBackgroundPattern,
  CardBackgroundTheme,
  CardEdgeRadius,
  CardBorderStyle,
  AgentStatusPostDoc,
} from '../types/firestore';
import { LocalCurrencyCode, formatCurrencyFromUsd, formatUsdPrice } from '../lib/fx';
import { quoteHandlePricing } from '../services/paymentRails';
import { AgentCardCarousel } from './AgentCardCarousel';
import { AgentIdentityCard } from './AgentIdentityCard';
import { PromotedStatusCircles } from './PromotedStatusCircles';
import { StatusReelsViewer } from './StatusReelsViewer';
import { SwipeScrollArea } from './SwipeScrollArea';
import { emitToast } from '../lib/toast';
import { AGENT_IMAGE_PRESETS } from '../lib/agentImages';

export type DirectoryFilterType = 'all' | 'persona' | 'business' | 'discoverable';
export type DirectoryViewMode = 'carousel' | 'grid';

interface DirectoryModuleProps {
  agents: AgentDoc[];
  bookings: BookingDoc[];
  currency: CurrencyMode;
  localCurrency?: LocalCurrencyCode;
  fxRates?: Record<LocalCurrencyCode, number>;
  ownerUid: string;
  filterType: DirectoryFilterType;
  viewMode: DirectoryViewMode;
  searchQuery: string;
  searchBarOpen: boolean;
  onFilterChange: (next: DirectoryFilterType) => void;
  onViewModeChange: (next: DirectoryViewMode) => void;
  onToggleSearchBar: () => void;
  onSearchQueryChange: (q: string) => void;
  onCloseSearchBar: () => void;
  onResetFilters: () => void;
  onSelectForEngage: (agent: AgentDoc) => void;
  onDialAgent: (agent: AgentDoc) => void;
  onEmailAgent: (agent: AgentDoc) => void;
  onDeployAgent: (agent: AgentDoc) => Promise<void>;
  onToggleDiscoverable: (agentId: string) => void;
  onOpenVideoStudio?: (agent: AgentDoc) => void;
  onCustomizeCard?: (agent: AgentDoc) => void;
  onSaveContact?: (agent: AgentDoc) => void;
  savedContactHandles?: Set<string>;
  openDeployModalInitially?: boolean;
  onCloseDeployModal?: () => void;
  onOpenQuickJobAgent?: () => void;
  onOpenQuickEmployerAgent?: () => void;
  onOpenProfileHistory?: (agent: AgentDoc) => void;
  onOpenCompanyHr?: (agent: AgentDoc) => void;
  statusPosts?: AgentStatusPostDoc[];
  onOpenPostStatus?: () => void;
}

export const DirectoryModule: React.FC<DirectoryModuleProps> = ({
  agents,
  bookings,
  currency,
  localCurrency = 'ZAR',
  fxRates,
  ownerUid,
  filterType,
  viewMode,
  searchQuery,
  searchBarOpen,
  onFilterChange,
  onViewModeChange,
  onToggleSearchBar,
  onSearchQueryChange,
  onCloseSearchBar,
  onResetFilters,
  onSelectForEngage,
  onDialAgent,
  onEmailAgent,
  onDeployAgent,
  onToggleDiscoverable,
  onOpenVideoStudio,
  onCustomizeCard,
  onSaveContact,
  savedContactHandles,
  openDeployModalInitially = false,
  onCloseDeployModal,
  onOpenQuickJobAgent,
  onOpenQuickEmployerAgent,
  onOpenProfileHistory,
  onOpenCompanyHr,
  statusPosts = [],
  onOpenPostStatus,
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(agents[0]?.id || null);
  const [reelOpen, setReelOpen] = useState(false);
  const [reelStartAgentId, setReelStartAgentId] = useState<string | null>(null);
  const [reelStartStatusId, setReelStartStatusId] = useState<string | null>(null);
  const [gridFlipped, setGridFlipped] = useState<Record<string, boolean>>({});
  const [showDeploy, setShowDeploy] = useState(openDeployModalInitially);

  // Deploy Wizard State
  const [newHandle, setNewHandle] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newOrg, setNewOrg] = useState('');
  const [newRole, setNewRole] = useState('Operator & Deal Delegate');
  const [newSummary, setNewSummary] = useState('');
  const [newType, setNewType] = useState<'persona' | 'business'>('persona');
  const [newRoleCategory, setNewRoleCategory] = useState<AgentRoleCategory>('job_seeker');
  const [newProfileUrl, setNewProfileUrl] = useState('');
  const [newBrandCode, setNewBrandCode] = useState('');
  const [maxSpendUSD, setMaxSpendUSD] = useState(2700);
  const [minDiscountPct, setMinDiscountPct] = useState(12);
  const [skillsCsv, setSkillsCsv] = useState('B2B Lead Gen, Calendar Sync, x402 Pay');
  const [buyerKind, setBuyerKind] = useState<'human' | 'bot'>('human');
  const [deploying, setDeploying] = useState(false);
  const [deployNotice, setDeployNotice] = useState<string | null>(null);

  // Deploy Card Styling Customization State
  const [newBannerStyle, setNewBannerStyle] = useState<CardBannerStyle>('gradient');
  const [newBgPattern, setNewBgPattern] = useState<CardBackgroundPattern>('subtle-grid');
  const [newBgTheme, setNewBgTheme] = useState<CardBackgroundTheme>('default');
  const [newEdgeRadius, setNewEdgeRadius] = useState<CardEdgeRadius>('rounded-2xl');
  const [newBorderStyle, setNewBorderStyle] = useState<CardBorderStyle>('hairline');
  const [newAccentColor, setNewAccentColor] = useState('#0284c7');
  const [newImageUrl, setNewImageUrl] = useState<string>('');
  const [provisionAgentMail, setProvisionAgentMail] = useState(true);

  React.useEffect(() => {
    setShowDeploy(openDeployModalInitially);
  }, [openDeployModalInitially]);

  const filtered = agents.filter((a) => {
    if (filterType === 'business' && a.type !== 'business') return false;
    if (filterType === 'persona' && a.type !== 'persona') return false;
    if (filterType === 'discoverable' && !a.discoverableByPassersby) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      a.handle.toLowerCase().includes(q) ||
      a.displayName.toLowerCase().includes(q) ||
      a.roleTitle.toLowerCase().includes(q) ||
      a.organization.toLowerCase().includes(q) ||
      (a.tagline || '').toLowerCase().includes(q) ||
      (a.summary || '').toLowerCase().includes(q) ||
      (a.impliedIntent?.headline || '').toLowerCase().includes(q) ||
      (a.impliedIntent?.topics || []).some((t) => t.toLowerCase().includes(q)) ||
      a.skills.some((s) => s.toLowerCase().includes(q))
    );
  });

  const handleQuote = quoteHandlePricing(newHandle || 'myagent');

  const closeDeploy = React.useCallback(() => {
    setShowDeploy(false);
    onCloseDeployModal?.();
  }, [onCloseDeployModal]);

  React.useEffect(() => {
    if (!showDeploy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDeploy();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDeploy, closeDeploy]);

  const handleDeploySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHandle.trim() || !newDisplayName.trim()) return;
    if (handleQuote.isProtectedCivic) {
      setDeployNotice('Civic emergency shortcodes are locked.');
      return;
    }
    setDeploying(true);
    setDeployNotice(null);
    const id = `agent_${Date.now()}`;
    const shortNum = String(Math.floor(500 + Math.random() * 499));
    const baseSlug = handleQuote.baseName.replace(/[^a-z0-9]/gi, '');
    const cleanUrl = newProfileUrl.trim().replace(/^https?:\/\//i, '');

    let resolvedAgentEmail = `engage@${handleQuote.normalizedHandle}`;
    if (provisionAgentMail) {
      try {
        const mailRes = await fetch('/api/agentmail/inboxes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            handle: handleQuote.normalizedHandle,
            displayName: newDisplayName.trim(),
          }),
        });
        if (mailRes.ok) {
          const mailData = await mailRes.json();
          if (mailData?.inbox?.email) {
            resolvedAgentEmail = mailData.inbox.email;
          }
        }
      } catch {
        // fallback cleanly to handle-based address
      }
    }

    const created: AgentDoc = {
      id,
      handle: handleQuote.normalizedHandle,
      ownerUid,
      displayName: newDisplayName.trim(),
      roleTitle: newRole.trim(),
      organization: newOrg.trim() || (newType === 'persona' ? 'Independent' : newDisplayName.trim()),
      type: newType,
      agentRoleCategory: newRoleCategory,
      poppySubdomain: `${baseSlug || 'operator'}.poppy.switchboard.agent`,
      poppyScopes: ['profile:read', 'cv:read', 'apply', 'calendar'],
      verified: true,
      popiaConsentActive: true,
      voiceNumber: `+27 87 243 ${shortNum}`,
      shortcode: shortNum,
      agentEmail: resolvedAgentEmail,
      mcpEndpoint: `https://agent.${baseSlug || 'switchboard'}.io/v1/interact`,
      linkedinUrl:
        newType === 'persona'
          ? cleanUrl || `linkedin.com/in/${baseSlug || 'operator'}`
          : undefined,
      websiteUrl:
        newType === 'business'
          ? cleanUrl || `${baseSlug || 'enterprise'}.co.za`
          : undefined,
      brandColor: newAccentColor,
      brandLogoCode:
        newType === 'business'
          ? (newBrandCode.trim() || newDisplayName.trim().slice(0, 3)).toUpperCase()
          : undefined,
      avatarVariant: 'persona',
      imageUrl: newImageUrl.trim() || undefined,
      cardStyle: {
        bannerStyle: newBannerStyle,
        bannerBgColor: newAccentColor,
        bannerHeight: 'normal',
        bannerBadgeStyle: 'glass',
        backgroundPattern: newBgPattern,
        backgroundTheme: newBgTheme,
        edgeRadius: newEdgeRadius,
        borderStyle: newBorderStyle,
        borderAccentColor: newAccentColor,
      },
      did:
        newType === 'persona'
          ? `did:linkedin:${baseSlug || 'operator'}-agent-v1`
          : `did:web:${cleanUrl || `${baseSlug}.co.za`}:agent-v1`,
      protocol: 'Poppy v1.0 / A2A / MCP',
      interactEndpoint: `https://agent.${baseSlug || 'switchboard'}.io/v1/interact`,
      authMethods: 'OAuth2 / Bearer / Public-Key',
      tagline:
        newType === 'persona'
          ? 'Human-verified identity. Agent-ready interface.'
          : 'Enterprise-verified identity. Agent-ready commerce.',
      summary:
        newSummary.trim() ||
        (newType === 'persona'
          ? `${newRole.trim()} specializing in automated A2A deals and calendar sync.`
          : `${newDisplayName.trim()} automated procurement, customer deals & x402 settlement desk.`),
      skills: skillsCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      guardrails: {
        maxAutoSpendZAR: usdToZar(Number(maxSpendUSD) || 2700),
        minDiscountPct: Number(minDiscountPct) || 10,
        blockedCategories: ['unverified-spam'],
        workingHoursSAST: '08:00-17:00',
        meetingBufferMins: 15,
        minExecMeetingValueZAR: 10000,
      },
      walletAddresses: {
        base: `0x${Math.random().toString(16).slice(2, 6).toUpperCase()}...${Math.random().toString(16).slice(2, 6).toUpperCase()}`,
        paypalVaultId: `VAULT_${handleQuote.baseName.toUpperCase().slice(0, 8)}`,
      },
      geoLocation: {
        lat: -26.0594 + (Math.random() - 0.5) * 0.02,
        lng: 27.9583 + (Math.random() - 0.5) * 0.02,
        radiusMeters: 150,
        label: 'Sandton / Randburg',
      },
      discoverableByPassersby: true,
      passerbyIncentive: `Open A2A · ${minDiscountPct}% Rebate`,
      calendarSyncEnabled: true,
      gmailBridgeEnabled: true,
      createdAt: new Date().toISOString(),
    };

    await onDeployAgent(created);
    setDeploying(false);
    setSelectedAgentId(created.id);
    emitToast(`Deployed ${created.handle}`);
    setNewHandle('');
    setNewDisplayName('');
    setNewProfileUrl('');
    setNewSummary('');
    setNewImageUrl('');
    closeDeploy();
  };

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Top Stories / Promoted Agent Circles Strip */}
      <PromotedStatusCircles
        agents={agents}
        statusPosts={statusPosts}
        selectedAgentId={selectedAgentId}
        onOpenReelForAgent={(agent) => {
          onResetFilters();
          setSelectedAgentId(agent.id);
          setReelStartStatusId(null);
          setReelStartAgentId(agent.id);
          setReelOpen(true);
        }}
        onOpenReelForStatus={(status) => {
          onResetFilters();
          setSelectedAgentId(status.agentId);
          setReelStartStatusId(status.id);
          setReelStartAgentId(status.agentId);
          setReelOpen(true);
        }}
        onOpenPostStatus={onOpenPostStatus}
      />

      {/* Compact Single-Row Filter & View Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-2 pb-1.5">
        <SwipeScrollArea
          direction="horizontal"
          showArrows={true}
          arrowSize="sm"
          className="flex-1 min-w-0"
          innerClassName="flex items-center gap-1 pr-6"
        >
          {(
            [
              { id: 'all', label: `All (${agents.length})` },
              { id: 'persona', label: 'Humans', icon: Users },
              { id: 'business', label: 'Companies', icon: Building2 },
              { id: 'discoverable', label: 'Live', icon: Radio },
            ] as Array<{ id: DirectoryFilterType; label: string; icon?: React.FC<{ className?: string }> }>
          ).map((f) => {
            const Icon = f.icon;
            const active = filterType === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onFilterChange(f.id)}
                className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold shadow-2xs'
                    : 'bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/25'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                <span>{f.label}</span>
              </button>
            );
          })}
        </SwipeScrollArea>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleSearchBar}
            className={`w-9 h-[34px] rounded-lg border flex items-center justify-center transition-colors ${
              searchBarOpen || searchQuery
                ? 'bg-zinc-950 border-zinc-950 text-white dark:bg-zinc-50 dark:border-white dark:text-zinc-950'
                : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400'
            }`}
            aria-label="Filter cards"
            title="Filter cards"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange(viewMode === 'carousel' ? 'grid' : 'carousel')}
            className="w-9 h-[34px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25 flex items-center justify-center transition-colors"
            aria-label={viewMode === 'carousel' ? 'Switch to Grid view' : 'Switch to Deck view'}
            title={viewMode === 'carousel' ? 'Grid View' : 'Deck View'}
          >
            {viewMode === 'carousel' ? (
              <LayoutGrid className="w-3.5 h-3.5" />
            ) : (
              <GalleryHorizontalEnd className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Inline Collapsible Search Strip */}
      {(searchBarOpen || searchQuery) && (
        <div className="shrink-0 pb-1.5">
          <div className="flex items-center rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 h-10 max-w-md mx-auto shadow-2xs">
            <Search className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0 mr-2" />
            <input
              type="text"
              autoFocus={searchBarOpen}
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search name, company, handle or skill..."
              className="w-full bg-transparent text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none"
            />
            <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 mr-2 shrink-0 tabular-nums">
              {filtered.length}
            </span>
            <button
              type="button"
              onClick={() => {
                onSearchQueryChange('');
                onCloseSearchBar();
              }}
              className="w-7 h-7 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0"
              aria-label="Close search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Unobstructed Card Stage */}
      <SwipeScrollArea
        direction="vertical"
        showArrows={viewMode === 'grid'}
        className="flex-1 min-h-0"
        innerClassName={viewMode === 'carousel' ? 'p-0' : 'py-1 pb-24'}
      >
        {filtered.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center my-8 space-y-3 max-w-sm mx-auto">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">No matching agent cards</p>
            <button
              type="button"
              onClick={onResetFilters}
              className="min-h-[38px] px-4 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 text-xs font-semibold dark:hover:bg-white"
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'carousel' ? (
          <div className="min-h-full w-full flex flex-col items-center justify-center py-1 pb-16 sm:pb-14">
            <AgentCardCarousel
              agents={filtered}
              bookings={bookings}
              currency={currency}
              selectedAgentId={selectedAgentId}
              onActiveAgentChange={(a) => setSelectedAgentId(a.id)}
              onSelectForEngage={onSelectForEngage}
              onDialAgent={onDialAgent}
              onEmailAgent={onEmailAgent}
              onToggleDiscoverable={onToggleDiscoverable}
              onOpenVideoStudio={onOpenVideoStudio}
              onCustomizeCard={onCustomizeCard}
              onSaveContact={onSaveContact}
              savedContactHandles={savedContactHandles}
              onOpenProfileHistory={onOpenProfileHistory}
              onOpenCompanyHr={onOpenCompanyHr}
              onUpdateAgentMedia={onDeployAgent}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-10">
            {filtered.map((agent) => (
              <div
                key={agent.id}
                onClick={() => setGridFlipped((p) => ({ ...p, [agent.id]: !p[agent.id] }))}
                onDoubleClick={() => onSelectForEngage(agent)}
                className="cursor-pointer"
              >
                <AgentIdentityCard
                  agent={agent}
                  bookings={bookings}
                  currency={currency}
                  flipped={Boolean(gridFlipped[agent.id])}
                  onFlipToggle={() =>
                    setGridFlipped((p) => ({ ...p, [agent.id]: !p[agent.id] }))
                  }
                  onEngage={onSelectForEngage}
                  onDial={onDialAgent}
                  onEmail={onEmailAgent}
                  onToggleDiscoverable={onToggleDiscoverable}
                  onOpenVideoStudio={onOpenVideoStudio}
                  onCustomize={onCustomizeCard}
                  onSaveContact={onSaveContact}
                  isSavedContact={Boolean(savedContactHandles?.has(agent.handle.toLowerCase()))}
                  onOpenProfileHistory={onOpenProfileHistory}
                  onOpenCompanyHr={onOpenCompanyHr}
                  onUpdateAgentMedia={onDeployAgent}
                />
              </div>
            ))}
          </div>
        )}
      </SwipeScrollArea>

      {/* Deploy Card Modal */}
      {showDeploy && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/60 dark:bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={closeDeploy}
        >
          <form
            onSubmit={handleDeploySubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl glass-panel rounded-t-3xl sm:rounded-2xl flex flex-col max-h-[90dvh] overflow-hidden"
          >
            <div className="shrink-0 px-4 sm:px-5 pt-3 sm:pt-4 pb-2.5 border-b border-zinc-200 dark:border-white/10">
              <div className="sm:hidden w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto mb-2" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={closeDeploy}
                    className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0"
                    aria-label="Back to Directory"
                    title="Back"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h2 className="font-display text-base font-bold text-zinc-950 dark:text-white tracking-tight truncate">
                    New Agent Card
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setBuyerKind('human')}
                    className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-medium border transition-colors ${
                      buyerKind === 'human'
                        ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-white'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-white/15'
                    }`}
                  >
                    Human
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuyerKind('bot')}
                    className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-medium border transition-colors ${
                      buyerKind === 'bot'
                        ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-white'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-white/15'
                    }`}
                  >
                    Bot (x402)
                  </button>
                  <button
                    type="button"
                    onClick={closeDeploy}
                    className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center ml-0.5"
                    aria-label="Close"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <SwipeScrollArea
              direction="vertical"
              arrowSize="sm"
              showArrows={true}
              className="flex-1 min-h-0"
              innerClassName="px-4 sm:px-5 py-4 space-y-4"
            >

            {onOpenQuickJobAgent && (
              <div className="rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-500/30 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-sky-950 dark:text-sky-200">
                    Starting a job search? Use 1-Click LinkedIn Quickstart
                  </p>
                  <p className="text-[11px] text-sky-800 dark:text-sky-300/90">
                    Paste your LinkedIn URL to get a free Standard .agent card, @agentmail.to inbox, 10 job matches &amp; interview booking.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    closeDeploy();
                    onOpenQuickJobAgent();
                  }}
                  className="min-h-[36px] px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors"
                >
                  <Linkedin className="w-3.5 h-3.5" />
                  <span>Quickstart</span>
                </button>
              </div>
            )}

            {onOpenQuickEmployerAgent && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-emerald-950 dark:text-emerald-200">
                    Hiring company? Use 1-Click Job Listing Quickstart
                  </p>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300/90">
                    Paste your job listing or careers page URL to deploy an Employer Agent, post vacancies &amp; auto-match candidate agents.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    closeDeploy();
                    onOpenQuickEmployerAgent();
                  }}
                  className="min-h-[36px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Hire Fast</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">.agent Handle</label>
                <input
                  type="text"
                  required
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                  placeholder="thabo.founder"
                  className="w-full min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 font-mono text-zinc-950 dark:text-white placeholder:text-zinc-500"
                />
                <span className="text-[10.5px] font-mono text-emerald-700 dark:text-emerald-400 mt-0.5 block">
                  {handleQuote.normalizedHandle} ·{' '}
                  {handleQuote.isProtectedCivic
                    ? 'LOCKED'
                    : buyerKind === 'bot'
                    ? `${formatUsdPrice(handleQuote.botX402PriceUSD)}${
                        localCurrency !== 'USD'
                          ? ` (≈ ${formatCurrencyFromUsd(handleQuote.botX402PriceUSD, localCurrency, fxRates)})`
                          : ''
                      }`
                    : handleQuote.humanPriceUSD === 0
                    ? 'FREE'
                    : `${formatUsdPrice(handleQuote.humanPriceUSD)}${
                        localCurrency !== 'USD'
                          ? ` (≈ ${formatCurrencyFromUsd(handleQuote.humanPriceUSD, localCurrency, fxRates)})`
                          : ''
                      }`}
                </span>
              </div>

              <div>
                <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">
                  {newType === 'persona' ? 'Full Name' : 'Company Name'}
                </label>
                <input
                  type="text"
                  required
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder={newType === 'persona' ? 'Thabo Mokoena' : 'Discovery Bank'}
                  className="w-full min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-950 dark:text-white placeholder:text-zinc-500"
                />
              </div>

              <div>
                <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">Card Type</label>
                <select
                  value={newType}
                  onChange={(e) => {
                    const nextType = e.target.value as 'persona' | 'business';
                    setNewType(nextType);
                    setNewRoleCategory(nextType === 'persona' ? 'job_seeker' : 'hiring');
                  }}
                  className="w-full min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-900 dark:text-zinc-200"
                >
                  <option value="persona">Personal (LinkedIn)</option>
                  <option value="business">Business (Company Logo)</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">Poppy Role</label>
                <select
                  value={newRoleCategory}
                  onChange={(e) => setNewRoleCategory(e.target.value as AgentRoleCategory)}
                  className="w-full min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-900 dark:text-zinc-200"
                >
                  <option value="job_seeker">Job Seeker</option>
                  <option value="hiring">Company Hiring</option>
                  <option value="recruiter">Recruiter / Agency</option>
                  <option value="commerce">Commerce / B2B Desk</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">Role / Desk</label>
                <input
                  type="text"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-950 dark:text-white"
                />
              </div>

              <div>
                <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">
                  {newType === 'persona' ? 'Personal URL (LinkedIn, Portfolio, GitHub)' : 'Company / Careers URL'}
                </label>
                <input
                  type="text"
                  value={newProfileUrl}
                  onChange={(e) => setNewProfileUrl(e.target.value)}
                  placeholder={newType === 'persona' ? 'linkedin.com/in/thabo or thabo.dev' : 'discovery.co.za'}
                  className="w-full min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-950 dark:text-white placeholder:text-zinc-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">
                  {newType === 'persona' ? 'Summary' : 'Company Summary'}
                </label>
                <input
                  type="text"
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder={
                    newType === 'persona'
                      ? 'Short bio & capabilities...'
                      : 'Brief overview of products & SLAs...'
                  }
                  className="w-full min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-950 dark:text-white placeholder:text-zinc-500"
                />
              </div>

              {newType === 'business' ? (
                <div>
                  <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">Logo Code (2–3 Chars)</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={newBrandCode}
                    onChange={(e) => setNewBrandCode(e.target.value)}
                    placeholder="DSC"
                    className="w-full min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 font-mono uppercase text-zinc-950 dark:text-white placeholder:text-zinc-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">Organization</label>
                  <input
                    type="text"
                    value={newOrg}
                    onChange={(e) => setNewOrg(e.target.value)}
                    placeholder="Studio / Org"
                    className="w-full min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-950 dark:text-white placeholder:text-zinc-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">Cap (US$)</label>
                  <input
                    type="number"
                    value={maxSpendUSD}
                    onChange={(e) => setMaxSpendUSD(Number(e.target.value))}
                    className="w-full min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 font-mono tabular-nums text-zinc-950 dark:text-white"
                  />
                  <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-500">
                    ≈ {formatMoney(usdToZar(maxSpendUSD), localCurrency === 'USD' ? 'ZAR' : localCurrency)} ({localCurrency === 'USD' ? 'ZAR' : localCurrency})
                  </span>
                </div>

                <div>
                  <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">Min Disc (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={minDiscountPct}
                    onChange={(e) => setMinDiscountPct(Number(e.target.value))}
                    className="w-full min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 font-mono tabular-nums text-zinc-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">Skills (Comma-separated)</label>
                <input
                  type="text"
                  value={skillsCsv}
                  onChange={(e) => setSkillsCsv(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 font-mono text-zinc-900 dark:text-zinc-200"
                />
              </div>

              <label className="sm:col-span-2 flex items-center gap-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 px-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={provisionAgentMail}
                  onChange={(e) => setProvisionAgentMail(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                <span className="text-xs text-zinc-800 dark:text-zinc-200">
                  Assign a live <span className="font-mono font-semibold text-sky-700 dark:text-sky-400">@agentmail.to</span> inbox on deploy
                </span>
              </label>

              {/* Card Personalization & Edges Section */}
              <div className="sm:col-span-2 pt-2 border-t border-zinc-200 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-xs text-zinc-950 dark:text-white">
                    Card Personalization & Frame
                  </span>
                  <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
                    Bespoke Visual Identity
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">Banner Motif</label>
                    <select
                      value={newBannerStyle}
                      onChange={(e) => setNewBannerStyle(e.target.value as CardBannerStyle)}
                      className="w-full min-h-[36px] rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 text-zinc-900 dark:text-zinc-200 capitalize"
                    >
                      <option value="gradient">Gradient Linear</option>
                      <option value="circuit">Circuit Traces</option>
                      <option value="mesh">Radiant Mesh</option>
                      <option value="geometric">Geometric Wireframe</option>
                      <option value="horizon">Horizon Bands</option>
                      <option value="monogram">Monogram Crest</option>
                      <option value="wave">Carrier Waves</option>
                      <option value="carbon">Carbon Fiber</option>
                      <option value="minimal">Minimal Matte</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">Surface Tint</label>
                    <select
                      value={newBgTheme}
                      onChange={(e) => setNewBgTheme(e.target.value as CardBackgroundTheme)}
                      className="w-full min-h-[36px] rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 text-zinc-900 dark:text-zinc-200 capitalize"
                    >
                      <option value="default">Default Neutral</option>
                      <option value="pearl">Pearl Luster</option>
                      <option value="obsidian">Obsidian Midnight</option>
                      <option value="sapphire">Sapphire Oceanic</option>
                      <option value="emerald">Emerald Mint</option>
                      <option value="amber">Amber Honey</option>
                      <option value="amethyst">Amethyst Royal</option>
                      <option value="cyber">Cyber Steel</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">Pattern Overlay</label>
                    <select
                      value={newBgPattern}
                      onChange={(e) => setNewBgPattern(e.target.value as CardBackgroundPattern)}
                      className="w-full min-h-[36px] rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 text-zinc-900 dark:text-zinc-200 capitalize"
                    >
                      <option value="subtle-grid">Subtle Grid</option>
                      <option value="dots">Dot Matrix</option>
                      <option value="aurora">Aurora Glow</option>
                      <option value="topo">Topo Contours</option>
                      <option value="stripes">Speed Stripes</option>
                      <option value="circuit">Circuit Corner</option>
                      <option value="none">Solid / None</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">Corner Edges</label>
                    <select
                      value={newEdgeRadius}
                      onChange={(e) => setNewEdgeRadius(e.target.value as CardEdgeRadius)}
                      className="w-full min-h-[36px] rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 text-zinc-900 dark:text-zinc-200"
                    >
                      <option value="rounded-2xl">Modern (16px)</option>
                      <option value="rounded-3xl">Squircle (24px)</option>
                      <option value="rounded-[28px]">Organic (28px)</option>
                      <option value="rounded-xl">Crisp (12px)</option>
                      <option value="rounded-none">Sharp (0px)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">Border Style</label>
                    <select
                      value={newBorderStyle}
                      onChange={(e) => setNewBorderStyle(e.target.value as CardBorderStyle)}
                      className="w-full min-h-[36px] rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 text-zinc-900 dark:text-zinc-200 capitalize"
                    >
                      <option value="hairline">Hairline</option>
                      <option value="bold-accent">Bold Accent</option>
                      <option value="cyber-glow">Cyber Glow</option>
                      <option value="double">Double Luxury Rim</option>
                      <option value="dashed-tech">Dashed Tech</option>
                      <option value="frosted-glass">Frosted Glass</option>
                    </select>
                  </div>

                  <div className="min-w-0">
                    <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">Accent Color</label>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <input
                        type="color"
                        value={newAccentColor}
                        onChange={(e) => setNewAccentColor(e.target.value)}
                        className="w-9 h-9 rounded-lg border border-zinc-300 dark:border-white/15 cursor-pointer bg-transparent p-0.5 shrink-0"
                      />
                      <input
                        type="text"
                        value={newAccentColor}
                        onChange={(e) => setNewAccentColor(e.target.value)}
                        className="flex-1 min-w-0 min-h-[36px] rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2 font-mono text-[11px] text-zinc-900 dark:text-zinc-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Card Photo / Brand Image Picker */}
                <div>
                  <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1.5">
                    Card Portrait / Brand Photo
                  </label>
                  <SwipeScrollArea
                    direction="horizontal"
                    arrowSize="sm"
                    showArrows={true}
                    innerClassName="flex items-center gap-2 pb-1 pr-7"
                  >
                    {AGENT_IMAGE_PRESETS.filter((p) => p.type === newType).map((preset) => {
                      const active = newImageUrl === preset.src;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setNewImageUrl(preset.src)}
                          className={`shrink-0 w-12 h-14 rounded-lg overflow-hidden border transition-all ${
                            active
                              ? 'border-zinc-950 dark:border-white ring-2 ring-zinc-950/20 dark:ring-white/30'
                              : 'border-zinc-300 dark:border-white/15 opacity-80 hover:opacity-100'
                          }`}
                          title={preset.label}
                        >
                          <img
                            src={preset.src}
                            alt={preset.label}
                            referrerPolicy="no-referrer"
                            className={`w-full h-full object-cover ${
                              preset.type === 'persona' ? 'object-top' : 'object-center'
                            }`}
                          />
                        </button>
                      );
                    })}
                    <input
                      type="url"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="Or paste custom image URL..."
                      className="flex-1 min-w-[160px] min-h-[38px] rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 text-[11px] font-mono text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-500"
                    />
                  </SwipeScrollArea>
                </div>
              </div>
            </div>
            </SwipeScrollArea>

            <div className="shrink-0 flex items-center justify-between gap-2 px-4 sm:px-5 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-zinc-950/70">
              <span className="text-xs text-rose-600 dark:text-rose-400 truncate">{deployNotice || ''}</span>
              <button
                type="submit"
                disabled={deploying || handleQuote.isProtectedCivic}
                className="min-h-[40px] rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white px-5 text-xs font-semibold disabled:opacity-50 shrink-0"
              >
                {deploying ? 'Deploying...' : 'Deploy Card'}
              </button>
            </div>
          </form>
        </div>
      )}

      <StatusReelsViewer
        open={reelOpen}
        initialAgentId={reelStartAgentId}
        initialStatusId={reelStartStatusId}
        agents={agents}
        statusPosts={statusPosts}
        bookings={bookings}
        currency={currency}
        onClose={() => setReelOpen(false)}
        onActiveAgentChange={(a) => setSelectedAgentId(a.id)}
        onEngageAgent={onSelectForEngage}
        onDialAgent={onDialAgent}
        onEmailAgent={onEmailAgent}
        onToggleDiscoverable={onToggleDiscoverable}
        onOpenVideoStudio={onOpenVideoStudio}
        onOpenPostStatus={onOpenPostStatus}
      />
    </div>
  );
};
