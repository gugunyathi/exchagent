import React, { useState, useEffect } from 'react';
import {
  Menu,
  Plus,
  Phone,
  MapPin,
  Mail,
  Puzzle,
  Terminal,
  Bot,
  Search,
  Compass,
  Zap,
  Tag,
  X,
  LayoutGrid,
  GalleryHorizontalEnd,
  Users,
  Building2,
  SlidersHorizontal,
  Briefcase,
} from 'lucide-react';
import { AgentDoc } from './types/firestore';
import { useSwitchboardStore } from './store/useSwitchboardStore';
import {
  DirectoryModule,
  DirectoryFilterType,
  DirectoryViewMode,
} from './components/DirectoryModule';
import { NegotiationArenaModule } from './components/NegotiationArenaModule';
import { PoppyRecruitmentModule } from './components/PoppyRecruitmentModule';
import { RegistryMarketplaceModule } from './components/RegistryMarketplaceModule';
import { SpatialMapsDiscovery } from './components/SpatialMapsDiscovery';
import { OmnichannelCommsModule } from './components/OmnichannelCommsModule';
import { ChromeExtensionHub } from './components/ChromeExtensionHub';
import { DeveloperLedgerModule } from './components/DeveloperLedgerModule';
import { AgentSkillsPage } from './components/AgentSkillsPage';
import { SurfaceSimulatorFrame } from './components/SurfaceSimulatorFrame';
import { AgentDialerModal } from './components/AgentDialerModal';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { BurgerMenuDrawer, DrawerRouteTarget } from './components/BurgerMenuDrawer';
import { SwipeScrollArea } from './components/SwipeScrollArea';

type MainNavTab = 'directory' | 'arena' | 'registry' | 'spatial' | 'toolkit';

const NAV_TABS: Array<{ id: MainNavTab; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'directory', label: 'Cards', icon: Compass },
  { id: 'arena', label: 'Arena', icon: Zap },
  { id: 'registry', label: 'Handles', icon: Tag },
  { id: 'spatial', label: 'Radar', icon: MapPin },
  { id: 'toolkit', label: 'Skills', icon: Bot },
];

export default function App() {
  const store = useSwitchboardStore();
  const [activeTab, setActiveTab] = useState<MainNavTab>('directory');
  const [arenaSubView, setArenaSubView] = useState<'a2a' | 'poppy'>('a2a');
  const [spatialSubView, setSpatialSubView] = useState<'maps' | 'comms'>('maps');
  const [toolkitSubView, setToolkitSubView] = useState<'skills' | 'extension' | 'ledger'>('skills');

  // Floating Directory Controls
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilterType>('all');
  const [directoryViewMode, setDirectoryViewMode] = useState<DirectoryViewMode>('carousel');
  const [directorySearchQuery, setDirectorySearchQuery] = useState('');
  const [directorySearchOpen, setDirectorySearchOpen] = useState(false);
  const [floatingMenuExpanded, setFloatingMenuExpanded] = useState(false);
  const [poppyInitialRoleTab, setPoppyInitialRoleTab] = useState<'seeker' | 'hiring' | 'recruiter' | 'video_live'>('seeker');
  const [poppyInitialSeekerId, setPoppyInitialSeekerId] = useState<string | null>(null);

  const [selectedPitchAgent, setSelectedPitchAgent] = useState<AgentDoc | null>(null);
  const [selectedEmailAgent, setSelectedEmailAgent] = useState<AgentDoc | null>(null);
  const [openDeployWizard, setOpenDeployWizard] = useState(false);

  const [dialerOpen, setDialerOpen] = useState(false);
  const [dialerInitialAgent, setDialerInitialAgent] = useState<AgentDoc | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  useEffect(() => {
    const handler = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setCommandOpen(false);
        setDrawerOpen(false);
        setFloatingMenuExpanded(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pitchHandle = params.get('pitch');
    const tabParam = params.get('tab');
    if (tabParam === 'skills') {
      setActiveTab('toolkit');
      setToolkitSubView('skills');
    } else if (tabParam === 'poppy') {
      setActiveTab('arena');
      setArenaSubView('poppy');
    } else if (
      tabParam === 'directory' ||
      tabParam === 'arena' ||
      tabParam === 'registry' ||
      tabParam === 'spatial'
    ) {
      setActiveTab(tabParam);
    }
    if (pitchHandle) {
      const found = store.agents.find(
        (a) => a.handle.toLowerCase() === pitchHandle.toLowerCase()
      );
      if (found) {
        setSelectedPitchAgent(found);
        setActiveTab('arena');
      }
    }
  }, [store.agents]);

  const totalSavedZAR = store.settlements.reduce((sum, s) => sum + s.savedZAR, 0);
  const openRfpCount = store.rfps.filter((r) => r.status === 'OPEN').length;
  const pendingPoppyCount = store.poppyOperations.filter((o) => o.status === 'pending').length;

  const handleOpenPitch = (agent: AgentDoc) => {
    setSelectedPitchAgent(agent);
    store.setSurface('desktop');
    setActiveTab('arena');
    setArenaSubView('a2a');
  };

  const handleOpenVideoStudioForAgent = (agent: AgentDoc) => {
    setPoppyInitialSeekerId(agent.id);
    setPoppyInitialRoleTab('video_live');
    store.setSurface('desktop');
    setActiveTab('arena');
    setArenaSubView('poppy');
  };

  const handleOpenDialerForAgent = (agent: AgentDoc) => {
    setDialerInitialAgent(agent);
    setDialerOpen(true);
  };

  const handleDialNumberString = (numOrHandle: string) => {
    const found =
      store.agents.find(
        (a) =>
          a.handle === numOrHandle ||
          a.shortcode === numOrHandle ||
          (numOrHandle === '911' && a.handle === '911.emergency.agent')
      ) || null;
    setDialerInitialAgent(found);
    setDialerOpen(true);
  };

  const handleOpenEmailForAgent = (agent: AgentDoc) => {
    setSelectedEmailAgent(agent);
    store.setSurface('desktop');
    setActiveTab('spatial');
    setSpatialSubView('comms');
  };

  const handleDrawerNavigate = (target: DrawerRouteTarget) => {
    store.setSurface('desktop');
    setActiveTab(target.tab);
    if (target.tab === 'arena' && target.sub) {
      setArenaSubView(target.sub);
    } else if (target.tab === 'spatial') {
      setSpatialSubView(target.sub);
    } else if (target.tab === 'toolkit') {
      setToolkitSubView(target.sub);
    }
  };

  const commandAgents = store.agents.filter((a) => {
    const q = commandQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      a.handle.toLowerCase().includes(q) ||
      a.displayName.toLowerCase().includes(q) ||
      a.skills.some((s) => s.toLowerCase().includes(q))
    );
  });

  const handleFloatingSearchClick = () => {
    setFloatingMenuExpanded(false);
    if (activeTab === 'directory' && store.surface === 'desktop') {
      setDirectorySearchOpen((v) => !v);
    } else {
      setCommandOpen(true);
    }
  };

  const handleFloatingViewToggle = () => {
    setFloatingMenuExpanded(false);
    store.setSurface('desktop');
    setActiveTab('directory');
    setDirectoryViewMode((v) => (v === 'carousel' ? 'grid' : 'carousel'));
  };

  const handleFloatingFilterToggle = (target: 'persona' | 'business') => {
    setFloatingMenuExpanded(false);
    store.setSurface('desktop');
    setActiveTab('directory');
    setDirectoryFilter((prev) => (prev === target ? 'all' : target));
  };

  return (
    <div className="h-[100dvh] w-full aurora-canvas text-slate-100 flex flex-col overflow-hidden pt-[env(safe-area-inset-top)]">
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-3 py-1.5 text-xs text-center shrink-0">
          <span>
            Google Maps Platform quota reached.{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold"
            >
              Update account
            </a>
          </span>
        </div>
      )}

      {/* Ultra-Lean 1-Row Top Navigation Bar (44px mobile <= 15% sticky budget) */}
      <header className="h-11 sm:h-13 shrink-0 border-b border-slate-800/80 bg-[#050811]/90 backdrop-blur-xl z-40">
        <div className="max-w-7xl mx-auto h-full px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="w-9 h-9 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-center text-slate-200 hover:border-cyan-400/50 transition-colors shrink-0"
              aria-label="Open Menu"
              title="Menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <img src="/icon.svg" alt="Switchboard" className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg border border-cyan-400/30 shrink-0" />
            <span className="font-display font-bold text-sm sm:text-base tracking-tight text-white whitespace-nowrap shrink-0">
              Switchboard
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-1" aria-label="Primary Navigation">
            {NAV_TABS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id && store.surface === 'desktop';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    store.setSurface('desktop');
                    setActiveTab(item.id);
                  }}
                  className={`relative px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-400/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {item.id === 'arena' && pendingPoppyCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-mono font-bold inline-flex items-center justify-center">
                      {pendingPoppyCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <PWAInstallButton variant="header" />
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="w-9 h-9 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-center text-slate-300 hover:border-cyan-400/50 transition-colors"
              aria-label="Quick Search"
              title="Quick Jump (⌘K)"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                store.setSurface('desktop');
                setActiveTab('directory');
                setOpenDeployWizard(true);
              }}
              className="min-h-[36px] inline-flex items-center gap-1 rounded-xl bg-cyan-400 px-2.5 sm:px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0"
              aria-label="New Card"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Card</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Responsive Viewport Container */}
      <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-2 sm:px-6 py-1.5 sm:py-2.5 flex flex-col overflow-hidden">
        {store.surface !== 'desktop' ? (
          <SwipeScrollArea direction="vertical" className="flex-1 min-h-0" innerClassName="pb-24">
            <SurfaceSimulatorFrame
              surface={store.surface}
              agents={store.agents}
              rfps={store.rfps}
              settlements={store.settlements}
              currency={store.currency}
              onPitchAgent={handleOpenPitch}
              onDialNumber={handleDialNumberString}
              onSwitchToDesktop={() => store.setSurface('desktop')}
            />
          </SwipeScrollArea>
        ) : activeTab === 'directory' ? (
          <DirectoryModule
            agents={store.agents}
            bookings={store.bookings}
            currency={store.currency}
            ownerUid={store.currentUser.uid}
            filterType={directoryFilter}
            viewMode={directoryViewMode}
            searchQuery={directorySearchQuery}
            searchBarOpen={directorySearchOpen}
            onFilterChange={setDirectoryFilter}
            onViewModeChange={setDirectoryViewMode}
            onToggleSearchBar={() => setDirectorySearchOpen((v) => !v)}
            onSearchQueryChange={setDirectorySearchQuery}
            onCloseSearchBar={() => setDirectorySearchOpen(false)}
            onResetFilters={() => {
              setDirectoryFilter('all');
              setDirectorySearchQuery('');
              setDirectorySearchOpen(false);
            }}
            onSelectForPitch={handleOpenPitch}
            onDialAgent={handleOpenDialerForAgent}
            onEmailAgent={handleOpenEmailForAgent}
            onDeployAgent={store.addOrUpdateAgent}
            onToggleDiscoverable={store.toggleAgentDiscoverability}
            onOpenVideoStudio={handleOpenVideoStudioForAgent}
            openDeployModalInitially={openDeployWizard}
            onCloseDeployModal={() => setOpenDeployWizard(false)}
          />
        ) : (
          <SwipeScrollArea direction="vertical" className="flex-1 min-h-0" innerClassName="pb-24 space-y-3 sm:space-y-4">
            {activeTab === 'arena' && (
              <div className="space-y-3">
                <SwipeScrollArea direction="horizontal" innerClassName="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-900/85 border border-slate-800/90">
                  <button
                    type="button"
                    onClick={() => setArenaSubView('a2a')}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      arenaSubView === 'a2a'
                        ? 'bg-cyan-400 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    A2A &amp; Reverse-RFP
                  </button>
                  <button
                    type="button"
                    onClick={() => setArenaSubView('poppy')}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      arenaSubView === 'poppy'
                        ? 'bg-emerald-400 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    Poppy Hiring &amp; Video
                    {pendingPoppyCount > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          arenaSubView === 'poppy'
                            ? 'bg-slate-950 text-emerald-300'
                            : 'bg-amber-400/20 text-amber-300'
                        }`}
                      >
                        {pendingPoppyCount}
                      </span>
                    )}
                  </button>
                </SwipeScrollArea>

                {arenaSubView === 'a2a' ? (
                  <NegotiationArenaModule
                    agents={store.agents}
                    rfps={store.rfps}
                    negotiations={store.negotiations}
                    selectedTargetAgent={selectedPitchAgent}
                    currency={store.currency}
                    ownerUid={store.currentUser.uid}
                    onSaveNegotiation={store.saveNegotiation}
                    onSettleDeal={store.settleDeal}
                    onPublishRfp={store.publishRfp}
                    onAddBooking={store.addBooking}
                  />
                ) : (
                  <PoppyRecruitmentModule
                    agents={store.agents}
                    jobs={store.jobs}
                    matches={store.matches}
                    bookings={store.bookings}
                    poppyOperations={store.poppyOperations}
                    poppyConsents={store.poppyConsents}
                    poppyAuditLogs={store.poppyAuditLogs}
                    currency={store.currency}
                    workspaceToken={store.workspaceToken}
                    ownerUid={store.currentUser.uid}
                    initialRoleTab={poppyInitialRoleTab}
                    initialSeekerId={poppyInitialSeekerId}
                    onCreateJob={store.createJob}
                    onUpdateSeekerCv={store.updateSeekerCv}
                    onSaveVideo={store.updateCandidateVideo}
                    onAddPreScreenReview={store.addPreScreenReview}
                    onAddBooking={store.addBooking}
                    onConnectGoogle={store.loginGoogle}
                    onUpsertMatch={store.upsertRecruitmentMatch}
                    onProposeOperation={store.proposePoppyOperation}
                    onExecuteOperation={store.executePoppyOperation}
                    onDeclineOperation={store.declinePoppyOperation}
                    onToggleConsentScope={store.toggleConsentScope}
                    onRevokeAllConsents={store.revokeAllConsents}
                    onLogAudit={store.logPoppyAudit}
                  />
                )}
              </div>
            )}

            {activeTab === 'registry' && (
              <RegistryMarketplaceModule
                claimedHandles={store.claimedHandles}
                auctions={store.auctions}
                secondaryListings={store.secondaryListings}
                currency={store.currency}
                ownerUid={store.currentUser.uid}
                ownerName={store.currentUser.displayName}
                onClaimHandle={store.claimHandleRecord}
                onPlaceBid={store.placeAuctionBid}
                onBuyoutListing={store.buyoutSecondaryListing}
              />
            )}

            {activeTab === 'spatial' && (
              <div className="space-y-3">
                <SwipeScrollArea direction="horizontal" innerClassName="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-900/85 border border-slate-800/90">
                  <button
                    type="button"
                    onClick={() => setSpatialSubView('maps')}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      spatialSubView === 'maps'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Maps &amp; BLE Radar
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpatialSubView('comms')}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      spatialSubView === 'comms'
                        ? 'bg-emerald-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Mail &amp; Calendar ({store.bookings.length})
                  </button>
                </SwipeScrollArea>

                {spatialSubView === 'maps' ? (
                  <SpatialMapsDiscovery
                    agents={store.agents}
                    rfps={store.rfps}
                    userLocation={store.userLocation}
                    onUpdateUserLocation={store.setUserLocation}
                    passerbyEvents={store.passerbyEvents}
                    onAddPasserbyEvent={store.addPasserbyEvent}
                    dispatchedUnits={store.dispatchedUnits}
                    googleMapsApiKey={store.googleMapsApiKey}
                    currency={store.currency}
                    onPitchAgent={handleOpenPitch}
                  />
                ) : (
                  <OmnichannelCommsModule
                    agents={store.agents}
                    bookings={store.bookings}
                    emails={store.emails}
                    preselectedEmailTarget={selectedEmailAgent}
                    workspaceToken={store.workspaceToken}
                    currency={store.currency}
                    ownerUid={store.currentUser.uid}
                    onAddBooking={store.addBooking}
                    onAddEmail={store.addEmail}
                    onConnectGoogle={store.loginGoogle}
                  />
                )}
              </div>
            )}

            {activeTab === 'toolkit' && (
              <div className="space-y-3">
                <SwipeScrollArea direction="horizontal" innerClassName="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-900/85 border border-slate-800/90">
                  <button
                    type="button"
                    onClick={() => setToolkitSubView('skills')}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      toolkitSubView === 'skills'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5" />
                    Agent Skills
                  </button>
                  <button
                    type="button"
                    onClick={() => setToolkitSubView('extension')}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      toolkitSubView === 'extension'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Puzzle className="w-3.5 h-3.5" />
                    Extension
                  </button>
                  <button
                    type="button"
                    onClick={() => setToolkitSubView('ledger')}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      toolkitSubView === 'ledger'
                        ? 'bg-emerald-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    Ledger
                  </button>
                </SwipeScrollArea>

                {toolkitSubView === 'skills' ? (
                  <AgentSkillsPage />
                ) : toolkitSubView === 'extension' ? (
                  <ChromeExtensionHub
                    agents={store.agents}
                    onTriggerPitchFromSim={handleOpenPitch}
                  />
                ) : (
                  <DeveloperLedgerModule
                    settlements={store.settlements}
                    poppyOperations={store.poppyOperations}
                    poppyAuditLogs={store.poppyAuditLogs}
                    currency={store.currency}
                    firestoreOnline={store.firestoreOnline}
                    hasGoogleMapsKey={Boolean(store.googleMapsApiKey)}
                    workspaceConnected={Boolean(store.workspaceToken)}
                  />
                )}
              </div>
            )}
          </SwipeScrollArea>
        )}
      </main>

      {/* Backdrop when Speed-Dial Menu is expanded */}
      {floatingMenuExpanded && (
        <div
          className="fixed inset-0 z-30 bg-black/35 backdrop-blur-[1px]"
          onClick={() => setFloatingMenuExpanded(false)}
          aria-hidden="true"
        />
      )}

      {/* Compact Speed-Dial Floating Action Stack + Predictive Call Icon */}
      <div className="fixed bottom-[64px] md:bottom-6 right-2.5 sm:right-5 z-40 flex flex-col items-end gap-2">
        {floatingMenuExpanded && (
          <div className="flex flex-col items-end gap-1.5 mb-0.5">
            {[
              {
                label: directorySearchOpen ? 'Close Search' : 'Search Cards',
                icon: Search,
                active: directorySearchOpen,
                activeCls: 'bg-cyan-400 text-slate-950',
                onClick: handleFloatingSearchClick,
              },
              {
                label: directoryViewMode === 'carousel' ? 'Grid View' : 'Deck View',
                icon: directoryViewMode === 'carousel' ? LayoutGrid : GalleryHorizontalEnd,
                active: directoryViewMode === 'grid' && activeTab === 'directory',
                activeCls: 'bg-cyan-400 text-slate-950',
                onClick: handleFloatingViewToggle,
              },
              {
                label: 'Human Cards',
                icon: Users,
                active: directoryFilter === 'persona' && activeTab === 'directory',
                activeCls: 'bg-sky-400 text-slate-950',
                onClick: () => handleFloatingFilterToggle('persona'),
              },
              {
                label: 'Company Cards',
                icon: Building2,
                active: directoryFilter === 'business' && activeTab === 'directory',
                activeCls: 'bg-amber-400 text-slate-950',
                onClick: () => handleFloatingFilterToggle('business'),
              },
              {
                label: 'New Card',
                icon: Plus,
                active: false,
                activeCls: 'bg-emerald-400 text-slate-950',
                onClick: () => {
                  setFloatingMenuExpanded(false);
                  store.setSurface('desktop');
                  setActiveTab('directory');
                  setOpenDeployWizard(true);
                },
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="flex items-center gap-2 group"
                >
                  <span className="px-2.5 py-1 rounded-lg bg-[#060C1B]/95 border border-slate-700/80 text-[11px] font-medium text-slate-200 shadow-lg whitespace-nowrap">
                    {item.label}
                  </span>
                  <span
                    className={`w-10 h-10 rounded-full border shadow-xl flex items-center justify-center transition-transform active:scale-95 ${
                      item.active
                        ? `${item.activeCls} border-transparent`
                        : 'bg-[#081024]/95 border-slate-700 text-slate-100 group-hover:border-cyan-400/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFloatingMenuExpanded((v) => !v)}
            className={`w-8 h-8 rounded-full border shadow-lg flex items-center justify-center transition-colors ${
              floatingMenuExpanded
                ? 'bg-slate-800 border-cyan-400/60 text-cyan-300'
                : 'bg-[#060C1B]/90 border-slate-700/80 text-slate-300 hover:text-white'
            }`}
            aria-label="Toggle Quick Menu"
            title="Quick Actions"
          >
            {floatingMenuExpanded ? <X className="w-3.5 h-3.5" /> : <SlidersHorizontal className="w-3.5 h-3.5" />}
          </button>

          {/* Primary Floating Call Icon */}
          <button
            type="button"
            onClick={() => {
              setFloatingMenuExpanded(false);
              setDialerInitialAgent(null);
              setDialerOpen(true);
            }}
            className="w-11 h-11 rounded-full bg-cyan-400 text-slate-950 shadow-2xl shadow-cyan-500/25 hover:bg-cyan-300 flex items-center justify-center transition-transform active:scale-95"
            aria-label="Open Dialer"
            title="Predictive Dialer"
          >
            <Phone className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Bottom Icon Tab Bar (< md, min-56px + safe-area so icons never clip) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden min-h-[56px] pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] shrink-0 z-40 bg-[#050811]/95 backdrop-blur-xl border-t border-slate-800/90 grid grid-cols-5 items-center px-1"
      >
        {NAV_TABS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id && store.surface === 'desktop';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                store.setSurface('desktop');
                setActiveTab(item.id);
              }}
              className={`relative min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 w-6 h-0.5 rounded-full bg-cyan-400" aria-hidden="true" />
              )}
              <span className="relative">
                <Icon className="w-[18px] h-[18px]" />
                {item.id === 'arena' && pendingPoppyCount > 0 && (
                  <span className="absolute -top-1 -right-2 w-3.5 h-3.5 rounded-full bg-amber-400 text-slate-950 text-[8px] font-mono font-bold inline-flex items-center justify-center">
                    {pendingPoppyCount}
                  </span>
                )}
              </span>
              <span className="leading-none">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Slide-out Burger Menu Drawer */}
      <BurgerMenuDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeTab={activeTab}
        arenaSubView={arenaSubView}
        spatialSubView={spatialSubView}
        toolkitSubView={toolkitSubView}
        surface={store.surface}
        currency={store.currency}
        agentsCount={store.agents.length}
        openRfpCount={openRfpCount}
        totalSavedZAR={totalSavedZAR}
        settlementsCount={store.settlements.length}
        userMode={store.currentUser.mode}
        userDisplayName={store.currentUser.displayName}
        onNavigate={handleDrawerNavigate}
        onSetSurface={store.setSurface}
        onSetCurrency={store.setCurrency}
        onLoginGoogle={store.loginGoogle}
        onLoginPasskey={store.loginPasskeySim}
        onLogout={store.logout}
        onResetDemo={store.resetDemoData}
      />

      {/* Cmd/Ctrl+K Quick Jump Command Palette */}
      {commandOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center p-3 sm:p-4 pt-12 sm:pt-24"
          onClick={() => setCommandOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl glass-panel border border-slate-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
              <Search className="w-4 h-4 text-cyan-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Jump to .agent card or skill..."
                className="flex-1 min-h-[32px] bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                className="w-9 h-9 rounded-lg text-slate-400 hover:text-white flex items-center justify-center shrink-0"
                aria-label="Close Quick Search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <SwipeScrollArea direction="vertical" className="max-h-72" innerClassName="p-2 space-y-1">
              <button
                type="button"
                onClick={() => {
                  store.setSurface('desktop');
                  setActiveTab('toolkit');
                  setToolkitSubView('skills');
                  setCommandOpen(false);
                }}
                className="w-full min-h-[44px] text-left rounded-xl px-3 py-2 text-xs hover:bg-slate-800/80 flex items-center justify-between"
              >
                <span className="font-medium text-cyan-300 flex items-center gap-2">
                  <Bot className="w-4 h-4" /> Agent Skills (/skills.md)
                </span>
                <span className="font-mono text-slate-500">API</span>
              </button>

              {commandAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    handleOpenPitch(agent);
                    setCommandOpen(false);
                  }}
                  className="w-full min-h-[44px] text-left rounded-xl px-3 py-2 text-xs hover:bg-slate-800/80 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{agent.displayName}</p>
                    <p className="font-mono text-[11px] text-slate-400 truncate">{agent.handle}</p>
                  </div>
                  <Zap className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                </button>
              ))}
            </SwipeScrollArea>
          </div>
        </div>
      )}

      <AgentDialerModal
        open={dialerOpen}
        onClose={() => setDialerOpen(false)}
        agents={store.agents}
        initialAgent={dialerInitialAgent}
        userLocation={store.userLocation}
        callerUid={store.currentUser.uid}
        onSaveVoiceSession={store.saveVoiceSession}
      />

      <OfflineIndicator />
    </div>
  );
}
