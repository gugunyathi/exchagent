import React, { useState } from 'react';
import { Search, X, LayoutGrid, GalleryHorizontalEnd, Users, Building2, Radio } from 'lucide-react';
import {
  AgentDoc,
  AgentRoleCategory,
  BookingDoc,
  CurrencyMode,
  ZAR_PER_USD,
} from '../types/firestore';
import { quoteHandlePricing } from '../services/paymentRails';
import { AgentCardCarousel } from './AgentCardCarousel';
import { AgentIdentityCard } from './AgentIdentityCard';
import { PromotedStatusCircles } from './PromotedStatusCircles';
import { StatusReelsViewer } from './StatusReelsViewer';
import { SwipeScrollArea } from './SwipeScrollArea';

export type DirectoryFilterType = 'all' | 'persona' | 'business' | 'discoverable';
export type DirectoryViewMode = 'carousel' | 'grid';

interface DirectoryModuleProps {
  agents: AgentDoc[];
  bookings: BookingDoc[];
  currency: CurrencyMode;
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
  onSelectForPitch: (agent: AgentDoc) => void;
  onDialAgent: (agent: AgentDoc) => void;
  onEmailAgent: (agent: AgentDoc) => void;
  onDeployAgent: (agent: AgentDoc) => Promise<void>;
  onToggleDiscoverable: (agentId: string) => void;
  onOpenVideoStudio?: (agent: AgentDoc) => void;
  openDeployModalInitially?: boolean;
  onCloseDeployModal?: () => void;
}

export const DirectoryModule: React.FC<DirectoryModuleProps> = ({
  agents,
  bookings,
  currency,
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
  onSelectForPitch,
  onDialAgent,
  onEmailAgent,
  onDeployAgent,
  onToggleDiscoverable,
  onOpenVideoStudio,
  openDeployModalInitially = false,
  onCloseDeployModal,
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(agents[0]?.id || null);
  const [reelOpen, setReelOpen] = useState(false);
  const [reelStartAgentId, setReelStartAgentId] = useState<string | null>(null);
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
  const [maxSpendZAR, setMaxSpendZAR] = useState(50000);
  const [minDiscountPct, setMinDiscountPct] = useState(12);
  const [skillsCsv, setSkillsCsv] = useState('B2B Lead Gen, Calendar Sync, x402 Pay');
  const [buyerKind, setBuyerKind] = useState<'human' | 'bot'>('human');
  const [deploying, setDeploying] = useState(false);
  const [deployNotice, setDeployNotice] = useState<string | null>(null);

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
      a.organization.toLowerCase().includes(q) ||
      (a.summary || '').toLowerCase().includes(q) ||
      a.skills.some((s) => s.toLowerCase().includes(q))
    );
  });

  const handleQuote = quoteHandlePricing(newHandle || 'myagent');

  const closeDeploy = () => {
    setShowDeploy(false);
    onCloseDeployModal?.();
  };

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
      agentEmail: `pitch@${handleQuote.normalizedHandle}`,
      mcpEndpoint: `https://agent.${baseSlug || 'switchboard'}.io/v1/interact`,
      linkedinUrl:
        newType === 'persona'
          ? cleanUrl || `linkedin.com/in/${baseSlug || 'operator'}`
          : undefined,
      websiteUrl:
        newType === 'business'
          ? cleanUrl || `${baseSlug || 'enterprise'}.co.za`
          : undefined,
      brandColor: newType === 'business' ? '#0F766E' : undefined,
      brandLogoCode:
        newType === 'business'
          ? (newBrandCode.trim() || newDisplayName.trim().slice(0, 3)).toUpperCase()
          : undefined,
      avatarVariant: 'persona',
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
        maxAutoSpendZAR: Number(maxSpendZAR) || 50000,
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
    setDeployNotice(`Deployed ${created.handle}`);
    setNewHandle('');
    setNewDisplayName('');
    setNewProfileUrl('');
    setNewSummary('');
    setTimeout(() => {
      closeDeploy();
    }, 650);
  };

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Non-overlapping Top Stories / Promoted Agent Circles Strip */}
      <PromotedStatusCircles
        agents={agents}
        selectedAgentId={selectedAgentId}
        onOpenReelForAgent={(agent) => {
          onResetFilters();
          setSelectedAgentId(agent.id);
          setReelStartAgentId(agent.id);
          setReelOpen(true);
        }}
      />

      {/* Compact Single-Row Filter & View Toolbar (Replaces hidden icon hunting) */}
      <div className="shrink-0 flex items-center justify-between gap-2 pb-1.5">
        <SwipeScrollArea
          direction="horizontal"
          showArrows={false}
          className="flex-1 min-w-0"
          innerClassName="flex items-center gap-1"
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
                    ? 'bg-cyan-400 text-slate-950 font-semibold'
                    : 'bg-slate-900/75 border border-slate-800 text-slate-300 hover:text-white'
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
                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                : 'bg-slate-900/75 border-slate-800 text-slate-300 hover:text-white'
            }`}
            aria-label="Filter by text"
            title="Filter cards"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange(viewMode === 'carousel' ? 'grid' : 'carousel')}
            className="w-9 h-[34px] rounded-lg bg-slate-900/75 border border-slate-800 text-slate-200 hover:border-cyan-400/50 flex items-center justify-center transition-colors"
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

      {/* Inline Collapsible Search Strip (Never covers card avatar/details) */}
      {(searchBarOpen || searchQuery) && (
        <div className="shrink-0 pb-1.5">
          <div className="flex items-center rounded-xl bg-slate-950/90 border border-cyan-400/45 px-3 h-10 max-w-md mx-auto">
            <Search className="w-3.5 h-3.5 text-cyan-400 shrink-0 mr-2" />
            <input
              type="text"
              autoFocus={searchBarOpen}
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search name, company, handle or skill..."
              className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
            />
            <span className="text-[10px] font-mono text-slate-400 mr-2 shrink-0 tabular-nums">
              {filtered.length}
            </span>
            <button
              type="button"
              onClick={() => {
                onSearchQueryChange('');
                onCloseSearchBar();
              }}
              className="w-7 h-7 rounded-lg text-slate-400 hover:text-white flex items-center justify-center shrink-0"
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
            <p className="text-sm font-medium text-slate-200">No matching agent cards</p>
            <button
              type="button"
              onClick={onResetFilters}
              className="min-h-[40px] px-4 rounded-xl bg-cyan-400 text-slate-950 text-xs font-semibold hover:bg-cyan-300"
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'carousel' ? (
          <div className="min-h-full w-full flex flex-col items-center justify-center py-1 pb-2">
            <AgentCardCarousel
              agents={filtered}
              bookings={bookings}
              currency={currency}
              selectedAgentId={selectedAgentId}
              onActiveAgentChange={(a) => setSelectedAgentId(a.id)}
              onSelectForPitch={onSelectForPitch}
              onDialAgent={onDialAgent}
              onEmailAgent={onEmailAgent}
              onToggleDiscoverable={onToggleDiscoverable}
              onOpenVideoStudio={onOpenVideoStudio}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-10">
            {filtered.map((agent) => (
              <div
                key={agent.id}
                onClick={() => setGridFlipped((p) => ({ ...p, [agent.id]: !p[agent.id] }))}
                onDoubleClick={() => onSelectForPitch(agent)}
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
                  onPitch={onSelectForPitch}
                  onDial={onDialAgent}
                  onEmail={onEmailAgent}
                  onToggleDiscoverable={onToggleDiscoverable}
                  onOpenVideoStudio={onOpenVideoStudio}
                />
              </div>
            ))}
          </div>
        )}
      </SwipeScrollArea>

      {/* Deploy Card Modal */}
      {showDeploy && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={closeDeploy}
        >
          <form
            onSubmit={handleDeploySubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl glass-panel rounded-t-3xl sm:rounded-2xl border border-slate-700 p-4 sm:p-5 space-y-4 max-h-[90dvh] overflow-y-auto no-scrollbar pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <div className="sm:hidden w-10 h-1 rounded-full bg-slate-700 mx-auto -mt-1 mb-1" />
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <h2 className="text-base font-semibold text-white">New Agent Card</h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setBuyerKind('human')}
                  className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-medium ${
                    buyerKind === 'human'
                      ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                      : 'text-slate-400 border border-slate-800'
                  }`}
                >
                  Human
                </button>
                <button
                  type="button"
                  onClick={() => setBuyerKind('bot')}
                  className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-medium ${
                    buyerKind === 'bot'
                      ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                      : 'text-slate-400 border border-slate-800'
                  }`}
                >
                  Bot (x402)
                </button>
                <button
                  type="button"
                  onClick={closeDeploy}
                  className="w-9 h-9 rounded-lg bg-slate-900 text-slate-400 hover:text-white flex items-center justify-center ml-1"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">.agent Handle</label>
                <input
                  type="text"
                  required
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                  placeholder="thabo.founder"
                  className="w-full min-h-[42px] rounded-xl bg-slate-950/85 border border-slate-800 px-3 py-2 font-mono text-cyan-200"
                />
                <span className="text-[10px] font-mono text-emerald-400 mt-0.5 block">
                  {handleQuote.normalizedHandle} ·{' '}
                  {handleQuote.isProtectedCivic
                    ? 'LOCKED'
                    : buyerKind === 'bot'
                    ? `$${handleQuote.botX402PriceUSD.toFixed(2)}`
                    : handleQuote.humanPriceUSD === 0
                    ? 'FREE'
                    : `$${handleQuote.humanPriceUSD}`}
                </span>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">
                  {newType === 'persona' ? 'Full Name' : 'Company Name'}
                </label>
                <input
                  type="text"
                  required
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder={newType === 'persona' ? 'Thabo Mokoena' : 'Discovery Bank'}
                  className="w-full min-h-[42px] rounded-xl bg-slate-950/85 border border-slate-800 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Card Type</label>
                <select
                  value={newType}
                  onChange={(e) => {
                    const nextType = e.target.value as 'persona' | 'business';
                    setNewType(nextType);
                    setNewRoleCategory(nextType === 'persona' ? 'job_seeker' : 'hiring');
                  }}
                  className="w-full min-h-[42px] rounded-xl bg-slate-950/85 border border-slate-800 px-3 py-2 text-slate-200"
                >
                  <option value="persona">Personal (LinkedIn)</option>
                  <option value="business">Business (Company Logo)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Poppy Agent Role</label>
                <select
                  value={newRoleCategory}
                  onChange={(e) => setNewRoleCategory(e.target.value as AgentRoleCategory)}
                  className="w-full min-h-[42px] rounded-xl bg-slate-950/85 border border-slate-800 px-3 py-2 text-slate-200"
                >
                  <option value="job_seeker">Job Seeker Agent</option>
                  <option value="hiring">Company Hiring Agent</option>
                  <option value="recruiter">Recruiter / Agency</option>
                  <option value="commerce">Commerce / B2B Desk</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Role / Desk</label>
                <input
                  type="text"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl bg-slate-950/85 border border-slate-800 px-3 py-2 text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-slate-400 block mb-1">
                  {newType === 'persona' ? 'Brief User Summary' : 'Brief Business Summary'}
                </label>
                <input
                  type="text"
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder={
                    newType === 'persona'
                      ? 'Short bio & what your agent negotiates...'
                      : 'Brief overview of products, SLAs & deals...'
                  }
                  className="w-full min-h-[42px] rounded-xl bg-slate-950/85 border border-slate-800 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">
                  {newType === 'persona' ? 'LinkedIn URL' : 'Website URL'}
                </label>
                <input
                  type="text"
                  value={newProfileUrl}
                  onChange={(e) => setNewProfileUrl(e.target.value)}
                  placeholder={newType === 'persona' ? 'linkedin.com/in/thabo' : 'discovery.co.za'}
                  className="w-full min-h-[42px] rounded-xl bg-slate-950/85 border border-slate-800 px-3 py-2 text-white"
                />
              </div>

              {newType === 'business' ? (
                <div>
                  <label className="text-slate-400 block mb-1">Logo Code (2–3 Chars)</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={newBrandCode}
                    onChange={(e) => setNewBrandCode(e.target.value)}
                    placeholder="DSC"
                    className="w-full min-h-[42px] rounded-xl bg-slate-950/85 border border-slate-800 px-3 py-2 font-mono uppercase text-white"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-slate-400 block mb-1">Organization</label>
                  <input
                    type="text"
                    value={newOrg}
                    onChange={(e) => setNewOrg(e.target.value)}
                    placeholder="Studio / Org"
                    className="w-full min-h-[42px] rounded-xl bg-slate-950/85 border border-slate-800 px-3 py-2 text-white"
                  />
                </div>
              )}

              <div>
                <label className="text-slate-400 block mb-1">Auto-Spend Cap (ZAR)</label>
                <input
                  type="number"
                  value={maxSpendZAR}
                  onChange={(e) => setMaxSpendZAR(Number(e.target.value))}
                  className="w-full min-h-[42px] rounded-xl bg-slate-950/85 border border-slate-800 px-3 py-2 font-mono text-white"
                />
                <span className="text-[10px] font-mono text-slate-500">
                  ≈ ${(maxSpendZAR / ZAR_PER_USD).toFixed(0)} USD
                </span>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Min Discount (%)</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={minDiscountPct}
                  onChange={(e) => setMinDiscountPct(Number(e.target.value))}
                  className="w-full min-h-[42px] rounded-xl bg-slate-950/85 border border-slate-800 px-3 py-2 font-mono text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-slate-400 block mb-1">Skills (Comma-separated)</label>
                <input
                  type="text"
                  value={skillsCsv}
                  onChange={(e) => setSkillsCsv(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl bg-slate-950/85 border border-slate-800 px-3 py-2 font-mono text-slate-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <span className="text-xs text-emerald-300">{deployNotice || ''}</span>
              <button
                type="submit"
                disabled={deploying || handleQuote.isProtectedCivic}
                className="min-h-[44px] rounded-xl bg-emerald-400 px-5 text-xs font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50"
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
        agents={agents}
        bookings={bookings}
        currency={currency}
        onClose={() => setReelOpen(false)}
        onActiveAgentChange={(a) => setSelectedAgentId(a.id)}
        onPitchAgent={onSelectForPitch}
        onDialAgent={onDialAgent}
        onEmailAgent={onEmailAgent}
        onToggleDiscoverable={onToggleDiscoverable}
        onOpenVideoStudio={onOpenVideoStudio}
      />
    </div>
  );
};
