import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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
import { CardCustomizationModal } from './components/CardCustomizationModal';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { BurgerMenuDrawer, DrawerRouteTarget } from './components/BurgerMenuDrawer';
import { SwipeScrollArea } from './components/SwipeScrollArea';
import { ToastViewport } from './lib/toast';
import { ThemeToggle } from './lib/theme';

export type MainNavTab = 'directory' | 'arena' | 'hiring' | 'registry' | 'spatial' | 'toolkit';

const PRIMARY_NAV_TABS: Array<{
  id: Exclude<MainNavTab, 'toolkit'>;
  label: string;
  mobileLabel: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'directory', label: 'Directory', mobileLabel: 'Directory', icon: Compass },
  { id: 'arena', label: 'Negotiate', mobileLabel: 'Negotiate', icon: Zap },
  { id: 'hiring', label: 'Hiring', mobileLabel: 'Hiring', icon: Briefcase },
  { id: 'registry', label: 'Registry', mobileLabel: 'Registry', icon: Tag },
  { id: 'spatial', label: 'Inbox & Map', mobileLabel: 'Map', icon: MapPin },
];

export default function App() {
  const store = useSwitchboardStore();
  const [activeTab, setActiveTab] = useState<MainNavTab>('directory');
  const [spatialSubView, setSpatialSubView] = useState<'maps' | 'comms'>('maps');
  const [toolkitSubView, setToolkitSubView] = useState<'skills' | 'extension' | 'ledger'>('skills');

  // Floating Directory Quick Actions
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
  const [customizingAgent, setCustomizingAgent] = useState<AgentDoc | null>(null);
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
    } else if (tabParam === 'poppy' || tabParam === 'hiring') {
      setActiveTab('hiring');
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
  };

  const handleOpenVideoStudioForAgent = (agent: AgentDoc) => {
    setPoppyInitialSeekerId(agent.id);
    setPoppyInitialRoleTab('video_live');
    store.setSurface('desktop');
    setActiveTab('hiring');
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
    if (target.tab === 'spatial') {
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
    <div className="h-[100dvh] w-full aurora-canvas text-zinc-950 dark:text-zinc-100 flex flex-col overflow-hidden pt-[env(safe-area-inset-top)]">
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 dark:bg-amber-950/90 border-b border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 px-3 py-1.5 text-xs text-center shrink-0">
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

      {/* Editorial Single-Row Top Header */}
      <header className="h-12 sm:h-14 shrink-0 border-b border-zinc-200 dark:border-white/[0.08] bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md z-40">
        <div className="max-w-7xl mx-auto h-full px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 shrink-0 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/25 transition-colors shrink-0"
              aria-label="Open Navigation Drawer"
              title="Menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                store.setSurface('desktop');
                setActiveTab('directory');
              }}
              className="flex items-center gap-2 text-left shrink-0"
            >
              <img
                src="/icon.svg"
                alt="Switchboard"
                className="w-6 h-6 rounded-md border border-zinc-300 dark:border-white/15 shrink-0"
              />
              <span className="font-display font-semibold text-sm sm:text-[15px] tracking-tight text-zinc-950 dark:text-zinc-50 whitespace-nowrap">
                Switchboard
              </span>
            </button>
          </div>

          <nav className="hidden md:flex items-center gap-1" aria-label="Primary Navigation">
            {PRIMARY_NAV_TABS.map((item) => {
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
                  className={`relative px-3 py-1.5 rounded-xl text-xs inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-zinc-100 text-zinc-950 border border-zinc-300 font-semibold shadow-2xs dark:bg-zinc-800/90 dark:text-white dark:border-white/15'
                      : 'text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100/70 dark:hover:bg-zinc-900/60 border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-zinc-950 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  />
                  <span>{item.label}</span>
                  {item.id === 'hiring' && pendingPoppyCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-400/20 dark:text-amber-300 dark:border-amber-400/30 text-[10px] font-mono font-semibold tabular-nums leading-none">
                      {pendingPoppyCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <ThemeToggle variant="header" />
            <PWAInstallButton variant="header" />
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="h-9 px-2.5 sm:px-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/25 transition-colors"
              aria-label="Quick Jump"
              title="Quick Jump (⌘K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden lg:inline text-xs font-medium">Jump</span>
              <kbd className="hidden lg:inline text-[10px] font-mono text-zinc-500 dark:text-zinc-400 border border-zinc-300 dark:border-white/15 rounded px-1 py-0.5 leading-none">
                ⌘K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => {
                store.setSurface('desktop');
                setActiveTab('directory');
                setOpenDeployWizard(true);
              }}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 dark:bg-zinc-50 px-3 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white transition-colors whitespace-nowrap shrink-0"
              aria-label="Create Agent Card"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Card</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Responsive Viewport Container */}
      <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-2 sm:px-6 py-2 sm:py-3 flex flex-col overflow-hidden">
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
            onCustomizeCard={(agent) => setCustomizingAgent(agent)}
            openDeployModalInitially={openDeployWizard}
            onCloseDeployModal={() => setOpenDeployWizard(false)}
          />
        ) : (
          <SwipeScrollArea direction="vertical" className="flex-1 min-h-0" innerClassName="pb-24 space-y-4">
            {activeTab === 'arena' && (
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
            )}

            {activeTab === 'hiring' && (
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
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setSpatialSubView('maps')}
                    className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3.5 text-xs whitespace-nowrap transition-colors ${
                      spatialSubView === 'maps'
                        ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-950 dark:hover:text-zinc-100'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Maps &amp; BLE Radar
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpatialSubView('comms')}
                    className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3.5 text-xs whitespace-nowrap transition-colors ${
                      spatialSubView === 'comms'
                        ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-950 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Inbox &amp; Calendar
                    <span className="font-mono text-[11px] opacity-80 tabular-nums">
                      ({store.bookings.length})
                    </span>
                  </button>
                </div>

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
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setToolkitSubView('skills')}
                    className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3.5 text-xs whitespace-nowrap transition-colors ${
                      toolkitSubView === 'skills'
                        ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-950 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5" />
                    Agent Skills
                  </button>
                  <button
                    type="button"
                    onClick={() => setToolkitSubView('extension')}
                    className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3.5 text-xs whitespace-nowrap transition-colors ${
                      toolkitSubView === 'extension'
                        ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-950 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Puzzle className="w-3.5 h-3.5" />
                    Extension
                  </button>
                  <button
                    type="button"
                    onClick={() => setToolkitSubView('ledger')}
                    className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3.5 text-xs whitespace-nowrap transition-colors ${
                      toolkitSubView === 'ledger'
                        ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-950 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    Ledger
                  </button>
                </div>

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

      {/* Backdrop when Quick Actions Menu is open */}
      {floatingMenuExpanded && (
        <div
          className="fixed inset-0 z-30 bg-black/30 dark:bg-black/45"
          onClick={() => setFloatingMenuExpanded(false)}
          aria-hidden="true"
        />
      )}

      {/* Consolidated Single Floating Action Cluster (Unobtrusive Bottom-Right) */}
      <div className="fixed bottom-[68px] md:bottom-5 right-3 sm:right-5 z-40 flex flex-col items-end gap-2">
        <AnimatePresence>
          {floatingMenuExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 shadow-2xl p-1.5 w-48 space-y-0.5"
            >
              {[
                {
                  label: directorySearchOpen ? 'Close Search' : 'Search Cards',
                  icon: Search,
                  active: directorySearchOpen,
                  onClick: handleFloatingSearchClick,
                },
                {
                  label: directoryViewMode === 'carousel' ? 'Grid View' : 'Deck View',
                  icon: directoryViewMode === 'carousel' ? LayoutGrid : GalleryHorizontalEnd,
                  active: directoryViewMode === 'grid' && activeTab === 'directory',
                  onClick: handleFloatingViewToggle,
                },
                {
                  label: 'Human Cards',
                  icon: Users,
                  active: directoryFilter === 'persona' && activeTab === 'directory',
                  onClick: () => handleFloatingFilterToggle('persona'),
                },
                {
                  label: 'Company Cards',
                  icon: Building2,
                  active: directoryFilter === 'business' && activeTab === 'directory',
                  onClick: () => handleFloatingFilterToggle('business'),
                },
                {
                  label: 'New Card',
                  icon: Plus,
                  active: false,
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
                    className={`w-full min-h-[36px] px-2.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
                      item.active
                        ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Single Consolidated Pill: Quick Menu + Predictive Dialer */}
        <div className="flex items-center p-1 rounded-full bg-white/95 dark:bg-zinc-900/95 border border-zinc-300 dark:border-white/15 shadow-xl gap-1">
          <button
            type="button"
            onClick={() => setFloatingMenuExpanded((v) => !v)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              floatingMenuExpanded
                ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white'
                : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/70'
            }`}
            aria-label="Toggle Quick Menu"
            title="Quick Actions"
          >
            {floatingMenuExpanded ? (
              <X className="w-4 h-4" />
            ) : (
              <SlidersHorizontal className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setFloatingMenuExpanded(false);
              setDialerInitialAgent(null);
              setDialerOpen(true);
            }}
            className="h-9 px-3.5 rounded-full bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white flex items-center gap-1.5 text-xs font-semibold transition-transform active:scale-95"
            aria-label="Open Predictive Dialer"
            title="Predictive Dialer"
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dial</span>
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden min-h-[56px] pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] shrink-0 z-40 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md border-t border-zinc-200 dark:border-white/[0.08] grid grid-cols-5 items-center px-1"
      >
        {PRIMARY_NAV_TABS.map((item) => {
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
              className={`relative min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] transition-colors ${
                isActive
                  ? 'text-zinc-950 dark:text-white font-semibold'
                  : 'text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 w-6 h-0.5 rounded-full bg-zinc-950 dark:bg-white" aria-hidden="true" />
              )}
              <span className="relative">
                <Icon className="w-[18px] h-[18px]" />
                {item.id === 'hiring' && pendingPoppyCount > 0 && (
                  <span className="absolute -top-1 -right-2 w-3.5 h-3.5 rounded-full bg-amber-400 text-zinc-950 text-[8px] font-mono font-bold inline-flex items-center justify-center">
                    {pendingPoppyCount}
                  </span>
                )}
              </span>
              <span className="leading-none">{item.mobileLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Slide-out Navigation & Account Drawer */}
      <BurgerMenuDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeTab={activeTab}
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
          className="fixed inset-0 z-50 bg-black/50 dark:bg-black/75 backdrop-blur-sm flex items-start justify-center p-3 sm:p-4 pt-12 sm:pt-24"
          onClick={() => setCommandOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl glass-panel border border-zinc-300 dark:border-white/15 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-white/[0.08]">
              <Search className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Jump to .agent handle, negotiation, or API skill..."
                className="flex-1 min-h-[32px] bg-transparent text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                className="w-8 h-8 rounded-lg text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center shrink-0"
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
                className="w-full min-h-[42px] text-left rounded-lg px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-between"
              >
                <span className="font-medium text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Agent Skills (/skills.md)
                </span>
                <span className="font-mono text-zinc-500">API</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  store.setSurface('desktop');
                  setActiveTab('toolkit');
                  setToolkitSubView('ledger');
                  setCommandOpen(false);
                }}
                className="w-full min-h-[42px] text-left rounded-lg px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-between"
              >
                <span className="font-medium text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Audit Ledger &amp; OpenAPI
                </span>
                <span className="font-mono text-zinc-500">x402</span>
              </button>

              {commandAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    handleOpenPitch(agent);
                    setCommandOpen(false);
                  }}
                  className="w-full min-h-[44px] text-left rounded-lg px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-950 dark:text-white truncate">{agent.displayName}</p>
                    <p className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400 truncate">{agent.handle}</p>
                  </div>
                  <Zap className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
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

      <CardCustomizationModal
        isOpen={Boolean(customizingAgent)}
        agent={customizingAgent}
        bookings={store.bookings}
        currency={store.currency}
        onClose={() => setCustomizingAgent(null)}
        onSave={(updated) => {
          store.addOrUpdateAgent(updated);
          setCustomizingAgent(null);
        }}
      />

      <ToastViewport />
      <OfflineIndicator />
    </div>
  );
}
