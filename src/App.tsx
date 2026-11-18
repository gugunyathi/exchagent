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
  ArrowLeft,
  Sparkles,
  History,
  Trophy,
  Linkedin,
  Scale,
  ShieldCheck,
  FileText,
  Home,
  Target,
  UserPlus,
  Radio,
  Activity,
} from 'lucide-react';
import {
  AgentDoc,
  AutonomousMatchItem,
  JobPostingDoc,
  RfpDoc,
  formatMoney,
} from './types/firestore';
import { LegalDocTab } from './data/legalDocuments';
import { useSwitchboardStore } from './store/useSwitchboardStore';
import { useNetworkAutopilot } from './hooks/useNetworkAutopilot';
import { MinimalLandingPage } from './components/MinimalLandingPage';
import { LegalDocumentView } from './components/LegalDocumentView';
import { PricingSection } from './components/PricingSection';
import { IntentProfilePage } from './components/IntentProfilePage';
import {
  DirectoryModule,
  DirectoryFilterType,
  DirectoryViewMode,
} from './components/DirectoryModule';
import { NegotiationArenaModule } from './components/NegotiationArenaModule';
import { PoppyRecruitmentModule } from './components/PoppyRecruitmentModule';
import { RegistryMarketplaceModule } from './components/RegistryMarketplaceModule';
import { SpatialMapsDiscovery } from './components/SpatialMapsDiscovery';
import { ContactsHubModule } from './components/ContactsHubModule';
import { OmnichannelCommsModule } from './components/OmnichannelCommsModule';
import { AgentMailInboxModule } from './components/AgentMailInboxModule';
import { ChromeExtensionHub } from './components/ChromeExtensionHub';
import { DeveloperLedgerModule } from './components/DeveloperLedgerModule';
import { AgentSkillsPage } from './components/AgentSkillsPage';
import { SurfaceSimulatorFrame } from './components/SurfaceSimulatorFrame';
import { AgentDialerModal } from './components/AgentDialerModal';
import { CardCustomizationModal } from './components/CardCustomizationModal';
import { QuickJobAgentModal } from './components/QuickJobAgentModal';
import { QuickEmployerAgentModal } from './components/QuickEmployerAgentModal';
import { AgentProfileHistoryModal } from './components/AgentProfileHistoryModal';
import { CompanyHrPortalModal } from './components/CompanyHrPortalModal';
import { PostStatusModal } from './components/PostStatusModal';
import { NetworkAutopilotModal } from './components/NetworkAutopilotModal';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { BurgerMenuDrawer, DrawerRouteTarget } from './components/BurgerMenuDrawer';
import { SwipeScrollArea } from './components/SwipeScrollArea';
import { ToastViewport, emitToast } from './lib/toast';
import { ThemeToggle } from './lib/theme';

export type MainNavTab =
  | 'home'
  | 'pricing'
  | 'legal'
  | 'directory'
  | 'intent'
  | 'arena'
  | 'hiring'
  | 'registry'
  | 'spatial'
  | 'toolkit';

function resolvePathRoute(pathname: string): { tab: MainNavTab; legalDoc: LegalDocTab } {
  const clean = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (clean === '/term' || clean === '/terms-of-use') {
    return { tab: 'legal', legalDoc: 'terms' };
  }
  if (clean === '/terms' || clean === '/privacy' || clean === '/candidate-terms') {
    return { tab: 'legal', legalDoc: 'privacy' };
  }
  if (clean === '/employeragreement' || clean === '/employer-agreement') {
    return { tab: 'legal', legalDoc: 'employer' };
  }
  if (clean === '/pricing' || clean === '/plans') {
    return { tab: 'pricing', legalDoc: 'terms' };
  }
  if (clean === '/intent') {
    return { tab: 'intent', legalDoc: 'terms' };
  }
  if (clean === '/directory' || clean === '/app') {
    return { tab: 'directory', legalDoc: 'terms' };
  }
  return { tab: 'home', legalDoc: 'terms' };
}

function getPathnameForLegalDoc(doc: LegalDocTab): string {
  if (doc === 'terms') return '/term';
  if (doc === 'privacy') return '/terms';
  return '/employeragreement';
}

const PRIMARY_NAV_TABS: Array<{
  id: Exclude<MainNavTab, 'home' | 'pricing' | 'legal' | 'toolkit'>;
  label: string;
  mobileLabel: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'directory', label: 'Directory', mobileLabel: 'Dir', icon: Compass },
  { id: 'intent', label: 'Intent', mobileLabel: 'Intent', icon: Target },
  { id: 'arena', label: 'Negotiate', mobileLabel: 'Deal', icon: Zap },
  { id: 'hiring', label: 'Hiring', mobileLabel: 'Hire', icon: Briefcase },
  { id: 'registry', label: 'Registry', mobileLabel: 'Reg', icon: Tag },
  { id: 'spatial', label: 'Radar & Contacts', mobileLabel: 'Radar', icon: MapPin },
];

export default function App() {
  const store = useSwitchboardStore();
  const initialRoute = React.useMemo(
    () => (typeof window !== 'undefined' ? resolvePathRoute(window.location.pathname) : { tab: 'home' as MainNavTab, legalDoc: 'terms' as LegalDocTab }),
    []
  );
  const [activeTab, setActiveTab] = useState<MainNavTab>(initialRoute.tab);
  const [legalDoc, setLegalDoc] = useState<LegalDocTab>(initialRoute.legalDoc);
  const [spatialSubView, setSpatialSubView] = useState<'maps' | 'contacts' | 'comms' | 'agentmail'>('maps');
  const [toolkitSubView, setToolkitSubView] = useState<'skills' | 'extension' | 'ledger'>('skills');
  const [navHistory, setNavHistory] = useState<
    Array<{
      tab: MainNavTab;
      legalDoc: LegalDocTab;
      spatialSub: 'maps' | 'contacts' | 'comms' | 'agentmail';
      toolkitSub: 'skills' | 'extension' | 'ledger';
      surface: ReturnType<typeof useSwitchboardStore>['surface'];
    }>
  >([]);

  // Floating Directory Quick Actions
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilterType>('all');
  const [directoryViewMode, setDirectoryViewMode] = useState<DirectoryViewMode>('carousel');
  const [directorySearchQuery, setDirectorySearchQuery] = useState('');
  const [directorySearchOpen, setDirectorySearchOpen] = useState(false);
  const [floatingMenuExpanded, setFloatingMenuExpanded] = useState(false);
  const [poppyInitialRoleTab, setPoppyInitialRoleTab] = useState<'seeker' | 'hiring' | 'recruiter' | 'video_live'>('seeker');
  const [poppyInitialSeekerId, setPoppyInitialSeekerId] = useState<string | null>(null);

  const [selectedEngageAgent, setSelectedEngageAgent] = useState<AgentDoc | null>(null);
  const [engageProposalPrefill, setEngageProposalPrefill] = useState<{
    title?: string;
    stickerPriceZAR?: number;
    nonce?: number;
  } | null>(null);
  const [selectedEmailAgent, setSelectedEmailAgent] = useState<AgentDoc | null>(null);
  const [openDeployWizard, setOpenDeployWizard] = useState(false);

  const [dialerOpen, setDialerOpen] = useState(false);
  const [dialerInitialAgent, setDialerInitialAgent] = useState<AgentDoc | null>(null);
  const [customizingAgent, setCustomizingAgent] = useState<AgentDoc | null>(null);
  const [quickJobModalOpen, setQuickJobModalOpen] = useState(false);
  const [quickEmployerModalOpen, setQuickEmployerModalOpen] = useState(false);
  const [postStatusModalOpen, setPostStatusModalOpen] = useState(false);
  const [profileHistoryState, setProfileHistoryState] = useState<{
    open: boolean;
    agent: AgentDoc | null;
    packageId?: string | null;
  }>({ open: false, agent: null, packageId: null });
  const [hrPortalAgent, setHrPortalAgent] = useState<AgentDoc | null>(null);
  const [networkAutopilotModalOpen, setNetworkAutopilotModalOpen] = useState(false);
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
    const onPopState = () => {
      const resolved = resolvePathRoute(window.location.pathname);
      setActiveTab(resolved.tab);
      setLegalDoc(resolved.legalDoc);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (activeTab === 'legal') {
      if (legalDoc === 'terms') {
        document.title = 'Terms of Use (/term) — SWITCHZ';
      } else if (legalDoc === 'privacy') {
        document.title = 'Privacy Policy & Candidate AI Notice (/terms) — SWITCHZ';
      } else {
        document.title = 'Global Employer Recruitment Agreement (/employeragreement) — SWITCHZ';
      }
    } else if (activeTab === 'pricing') {
      document.title = 'Pricing & Commercial Fee Schedule (/pricing) — SWITCHZ';
    } else if (activeTab === 'home') {
      document.title = 'SWITCHZ — Verified .agent Identity, Autonomous Hiring & A2A Commerce';
    } else {
      document.title = 'SWITCHZ — Agent Directory & A2A Hub';
    }
  }, [activeTab, legalDoc]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const engageHandle = params.get('engage');
    const tabParam = params.get('tab');
    if (tabParam === 'skills') {
      setActiveTab('toolkit');
      setToolkitSubView('skills');
    } else if (tabParam === 'poppy' || tabParam === 'hiring') {
      setActiveTab('hiring');
    } else if (tabParam === 'contacts') {
      setActiveTab('spatial');
      setSpatialSubView('contacts');
    } else if (
      tabParam === 'directory' ||
      tabParam === 'intent' ||
      tabParam === 'pricing' ||
      tabParam === 'arena' ||
      tabParam === 'registry' ||
      tabParam === 'spatial'
    ) {
      setActiveTab(tabParam);
    }
    if (engageHandle) {
      const found = store.agents.find(
        (a) => a.handle.toLowerCase() === engageHandle.toLowerCase()
      );
      if (found) {
        setSelectedEngageAgent(found);
        setActiveTab('arena');
      }
    }
  }, [store.agents]);

  const totalSavedZAR = store.settlements.reduce((sum, s) => sum + s.savedZAR, 0);
  const openRfpCount = store.rfps.filter((r) => r.status === 'OPEN').length;
  const pendingPoppyCount = store.poppyOperations.filter((o) => o.status === 'pending').length;

  const savedContactHandles = React.useMemo(
    () => new Set(store.contacts.map((c) => c.handle.toLowerCase())),
    [store.contacts]
  );

  const activeUserAgent = React.useMemo(
    () =>
      store.agents.find(
        (a) => a.ownerUid === store.currentUser.uid && a.handle !== '911.emergency.agent'
      ) ||
      store.agents.find((a) => a.handle === 'alex.founder.agent') ||
      store.agents[0] ||
      null,
    [store.agents, store.currentUser.uid]
  );

  const openAiCompanyAgent = React.useMemo(
    () =>
      store.agents.find((a) => a.handle === 'careers.openai.agent') ||
      store.agents.find((a) => a.type === 'business' && a.handle !== '911.emergency.agent') ||
      null,
    [store.agents]
  );

  const networkAutopilot = useNetworkAutopilot({
    activeUserAgent,
    userLocation: store.userLocation,
    onUpdateUserLocation: store.setUserLocation,
    negotiations: store.negotiations,
    settlements: store.settlements,
    onAutoAddPeers: store.autoAddProximityPeers,
    onRunAutonomousIntentMatch: store.runAutonomousIntentMatch,
    onSaveNegotiation: store.saveNegotiation,
    onSettleDeal: store.settleDeal,
    onAddPasserbyEvent: store.addPasserbyEvent,
    onLogAgentHistory: store.logAgentHistory,
  });

  const handleOpenProfileHistory = React.useCallback((agent: AgentDoc, packageId?: string) => {
    setProfileHistoryState({ open: true, agent, packageId: packageId || null });
  }, []);

  const handleOpenCompanyHr = React.useCallback((companyAgent: AgentDoc) => {
    setHrPortalAgent(companyAgent);
  }, []);

  const pushCurrentRouteToHistory = React.useCallback(
    (next: {
      tab?: MainNavTab;
      legalDoc?: LegalDocTab;
      spatialSub?: 'maps' | 'contacts' | 'comms' | 'agentmail';
      toolkitSub?: 'skills' | 'extension' | 'ledger';
      surface?: typeof store.surface;
    }) => {
      const targetTab = next.tab ?? activeTab;
      const targetLegalDoc = next.legalDoc ?? legalDoc;
      const targetSpatial = next.spatialSub ?? spatialSubView;
      const targetToolkit = next.toolkitSub ?? toolkitSubView;
      const targetSurface = next.surface ?? store.surface;
      if (
        targetTab === activeTab &&
        targetLegalDoc === legalDoc &&
        targetSpatial === spatialSubView &&
        targetToolkit === toolkitSubView &&
        targetSurface === store.surface
      ) {
        return;
      }
      setNavHistory((prev) => [
        ...prev.slice(-14),
        {
          tab: activeTab,
          legalDoc,
          spatialSub: spatialSubView,
          toolkitSub: toolkitSubView,
          surface: store.surface,
        },
      ]);
    },
    [activeTab, legalDoc, spatialSubView, toolkitSubView, store.surface]
  );

  const syncBrowserPath = React.useCallback((tab: MainNavTab, doc: LegalDocTab) => {
    if (typeof window === 'undefined') return;
    let nextPath = '/';
    if (tab === 'legal') {
      nextPath = getPathnameForLegalDoc(doc);
    } else if (tab === 'pricing') {
      nextPath = '/pricing';
    } else if (tab === 'intent') {
      nextPath = '/intent';
    } else if (tab === 'home') {
      nextPath = '/';
    } else if (window.location.pathname !== '/') {
      nextPath = '/';
    }
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  }, []);

  const navigateRoute = React.useCallback(
    (next: {
      tab?: MainNavTab;
      legalDoc?: LegalDocTab;
      spatialSub?: 'maps' | 'contacts' | 'comms' | 'agentmail';
      toolkitSub?: 'skills' | 'extension' | 'ledger';
      surface?: typeof store.surface;
    }) => {
      pushCurrentRouteToHistory(next);
      const nextTab = next.tab ?? activeTab;
      const nextDoc = next.legalDoc ?? legalDoc;
      if (next.surface !== undefined) store.setSurface(next.surface);
      if (next.tab !== undefined) setActiveTab(next.tab);
      if (next.legalDoc !== undefined) setLegalDoc(next.legalDoc);
      if (next.spatialSub !== undefined) setSpatialSubView(next.spatialSub);
      if (next.toolkitSub !== undefined) setToolkitSubView(next.toolkitSub);
      syncBrowserPath(nextTab, nextDoc);
    },
    [pushCurrentRouteToHistory, store, activeTab, legalDoc, syncBrowserPath]
  );

  const handleOpenLegalDoc = React.useCallback(
    (doc: LegalDocTab) => {
      navigateRoute({ surface: 'desktop', tab: 'legal', legalDoc: doc });
    },
    [navigateRoute]
  );

  const handleGoBack = React.useCallback(() => {
    if (navHistory.length > 0) {
      const last = navHistory[navHistory.length - 1];
      setNavHistory((prev) => prev.slice(0, -1));
      store.setSurface(last.surface);
      setActiveTab(last.tab);
      setLegalDoc(last.legalDoc);
      setSpatialSubView(last.spatialSub);
      setToolkitSubView(last.toolkitSub);
      syncBrowserPath(last.tab, last.legalDoc);
    } else if (store.surface !== 'desktop' || (activeTab !== 'directory' && activeTab !== 'home')) {
      store.setSurface('desktop');
      setActiveTab('directory');
      syncBrowserPath('directory', legalDoc);
    } else if (activeTab === 'directory') {
      setActiveTab('home');
      syncBrowserPath('home', legalDoc);
    }
  }, [navHistory, store, activeTab, legalDoc, syncBrowserPath]);

  const canGoBack =
    navHistory.length > 0 || activeTab !== 'home' || store.surface !== 'desktop';

  const resolveAgentByHandle = React.useCallback(
    (handle: string): AgentDoc => {
      const existing = store.agents.find(
        (a) => a.handle.toLowerCase() === handle.toLowerCase()
      );
      if (existing) return existing;

      const contact = store.contacts.find(
        (c) => c.handle.toLowerCase() === handle.toLowerCase()
      );
      return {
        id: contact?.agentId || `peer_${handle.replace(/[^a-z0-9]/gi, '_')}`,
        handle: contact?.handle || handle,
        ownerUid: contact?.ownerUid || store.currentUser.uid,
        displayName: contact?.displayName || handle.replace('.agent', ''),
        roleTitle: contact?.roleTitle || 'Event Mesh Agent',
        organization: contact?.organization || 'Independent Agent',
        type: contact?.type || 'persona',
        agentRoleCategory: contact?.agentRoleCategory,
        verified: contact?.verified ?? true,
        popiaConsentActive: true,
        voiceNumber: contact?.voiceNumber || '+27-87-AGENT-000',
        agentEmail: contact?.agentEmail || `engage@${handle}`,
        mcpEndpoint: `https://${handle}/mcp`,
        linkedinUrl: contact?.linkedinUrl,
        websiteUrl: contact?.websiteUrl,
        brandColor: contact?.brandColor,
        brandLogoCode: contact?.brandLogoCode,
        imageUrl: contact?.imageUrl,
        cardStyle: contact?.cardStyle,
        summary: contact?.summary,
        skills: contact?.skills || [],
        guardrails: contact?.guardrails || {
          maxAutoSpendZAR: 15000,
          minDiscountPct: 8,
          blockedCategories: [],
        },
        walletAddresses: {},
        createdAt: new Date().toISOString(),
      };
    },
    [store.agents, store.contacts, store.currentUser.uid]
  );

  const handleOpenEngage = (agent: AgentDoc) => {
    setSelectedEngageAgent(agent);
    setEngageProposalPrefill(null);
    navigateRoute({ surface: 'desktop', tab: 'arena' });
  };

  const handleEngageProposal = (params: {
    targetHandle: string;
    proposalTitle?: string;
    stickerPriceZAR?: number;
  }) => {
    const resolved = resolveAgentByHandle(params.targetHandle);
    setSelectedEngageAgent(resolved);
    setEngageProposalPrefill({
      title: params.proposalTitle,
      stickerPriceZAR: params.stickerPriceZAR,
      nonce: Date.now(),
    });
    navigateRoute({ surface: 'desktop', tab: 'arena' });
  };

  const handleOpenVideoStudioForAgent = (agent: AgentDoc) => {
    setPoppyInitialSeekerId(agent.id);
    setPoppyInitialRoleTab('video_live');
    navigateRoute({ surface: 'desktop', tab: 'hiring' });
  };

  const handleOpenDialerForAgent = (agent: AgentDoc) => {
    setDialerInitialAgent(agent);
    setDialerOpen(true);
  };

  const handleDialByHandle = (handle: string) => {
    const resolved = resolveAgentByHandle(handle);
    setDialerInitialAgent(resolved);
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
    navigateRoute({ surface: 'desktop', tab: 'spatial', spatialSub: 'comms' });
  };

  const handleEmailByHandle = (handle: string) => {
    const resolved = resolveAgentByHandle(handle);
    setSelectedEmailAgent(resolved);
    navigateRoute({ surface: 'desktop', tab: 'spatial', spatialSub: 'comms' });
  };

  const handleApplyJobFromRadar = (job: JobPostingDoc) => {
    const seeker = activeUserAgent || store.agents[0];
    if (!seeker) return;

    const seekerSkills = new Set(
      [...(seeker.skills || []), ...(seeker.cvSummary?.parsedSkills || [])].map((s) =>
        s.toLowerCase()
      )
    );
    const matched = job.requiredSkills.filter((req) =>
      Array.from(seekerSkills).some(
        (sk) => sk.includes(req.toLowerCase()) || req.toLowerCase().includes(sk)
      )
    );
    const skillsOverlap = Math.min(
      98,
      Math.round((matched.length / Math.max(1, job.requiredSkills.length)) * 100)
    );
    const score = Math.max(72, Math.min(97, Math.round(skillsOverlap * 0.65 + 32)));
    const opId = `op_radar_${Date.now()}`;
    const matchId = `match_${job.id}_${seeker.id}`;
    const now = new Date().toISOString();

    store.upsertRecruitmentMatch({
      id: matchId,
      jobId: job.id,
      jobTitle: job.title,
      companyAgentHandle: job.companyAgentHandle,
      seekerHandle: seeker.handle,
      seekerName: seeker.displayName,
      score,
      factors: {
        skillsOverlap: Math.max(60, skillsOverlap),
        experienceFit: 88,
        compensationFit: 90,
        locationCultureFit: job.remoteMode === 'Remote' ? 96 : 89,
      },
      explanation: `Matched via Spatial Job Radar (${job.location} · ${job.remoteMode}). ${matched.length} overlapping core competencies identified.`,
      strengths: matched.length > 0 ? matched : job.requiredSkills.slice(0, 2),
      gaps: job.requiredSkills.filter((s) => !matched.includes(s)).slice(0, 2),
      blindMode: Boolean(seeker.cvSummary?.blindScreening),
      status: 'applied',
      operationId: opId,
      updatedAt: now,
    });

    store.proposePoppyOperation({
      operation_id: opId,
      revision: 'v3',
      actionType: 'apply_job',
      summary: `Submit POPIA-minimized Poppy application for "${job.title}" at ${job.companyName}`,
      terms: {
        jobId: job.id,
        company: job.companyName,
        remoteMode: job.remoteMode,
        matchScore: score,
      },
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      createdAt: now,
      targetHandle: job.companyAgentHandle,
      actorHandle: seeker.handle,
    });

    emitToast(`Poppy application queued for ${job.title}`, 'success');
    setPoppyInitialRoleTab('seeker');
    navigateRoute({ surface: 'desktop', tab: 'hiring' });
  };

  const handleDrawerNavigate = (target: DrawerRouteTarget) => {
    if (target.tab === 'spatial') {
      navigateRoute({ surface: 'desktop', tab: 'spatial', spatialSub: target.sub });
    } else if (target.tab === 'toolkit') {
      navigateRoute({ surface: 'desktop', tab: 'toolkit', toolkitSub: target.sub });
    } else if (target.tab === 'legal') {
      navigateRoute({ surface: 'desktop', tab: 'legal', legalDoc: target.doc });
    } else {
      navigateRoute({ surface: 'desktop', tab: target.tab });
    }
  };

  const commandQ = commandQuery.trim().toLowerCase();

  const commandAgents = store.agents.filter((a) => {
    if (!commandQ) return true;
    return (
      a.handle.toLowerCase().includes(commandQ) ||
      a.displayName.toLowerCase().includes(commandQ) ||
      a.roleTitle.toLowerCase().includes(commandQ) ||
      a.organization.toLowerCase().includes(commandQ) ||
      a.skills.some((s) => s.toLowerCase().includes(commandQ)) ||
      (a.impliedIntent?.headline || '').toLowerCase().includes(commandQ) ||
      (a.impliedIntent?.topics || []).some((t) => t.toLowerCase().includes(commandQ))
    );
  });

  const commandJobs = commandQ
    ? store.jobs.filter(
        (j) =>
          j.status === 'OPEN' &&
          (j.title.toLowerCase().includes(commandQ) ||
            j.companyName.toLowerCase().includes(commandQ) ||
            j.location.toLowerCase().includes(commandQ) ||
            j.requiredSkills.some((s) => s.toLowerCase().includes(commandQ)) ||
            (j.description || '').toLowerCase().includes(commandQ))
      )
    : store.jobs.filter((j) => j.status === 'OPEN').slice(0, 3);

  const commandRfps = commandQ
    ? store.rfps.filter(
        (r) =>
          r.title.toLowerCase().includes(commandQ) ||
          r.publisherHandle.toLowerCase().includes(commandQ) ||
          r.category.toLowerCase().includes(commandQ) ||
          r.description.toLowerCase().includes(commandQ)
      )
    : store.rfps.filter((r) => r.status === 'OPEN').slice(0, 3);

  const commandContacts = commandQ
    ? store.contacts.filter(
        (c) =>
          c.displayName.toLowerCase().includes(commandQ) ||
          c.handle.toLowerCase().includes(commandQ) ||
          c.organization.toLowerCase().includes(commandQ) ||
          c.skills.some((s) => s.toLowerCase().includes(commandQ)) ||
          c.tags.some((t) => t.toLowerCase().includes(commandQ))
      )
    : [];

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
    navigateRoute({ surface: 'desktop', tab: 'directory' });
    setDirectoryViewMode((v) => (v === 'carousel' ? 'grid' : 'carousel'));
  };

  const handleFloatingFilterToggle = (target: 'persona' | 'business') => {
    setFloatingMenuExpanded(false);
    navigateRoute({ surface: 'desktop', tab: 'directory' });
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
      <header className="h-12 sm:h-14 shrink-0 border-b border-zinc-200 dark:border-white/[0.08] bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md z-40 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full px-2 sm:px-6 flex items-center justify-between gap-1 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/25 transition-colors shrink-0"
              aria-label="Open Navigation Drawer"
              title="Menu"
            >
              <Menu className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            {canGoBack && (
              <button
                type="button"
                onClick={handleGoBack}
                className="h-7 sm:h-9 px-1.5 sm:px-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center gap-1 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/25 transition-colors shrink-0"
                aria-label="Go back to previous page"
                title="Back"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigateRoute({ surface: 'desktop', tab: 'home' })}
              className="flex items-center gap-1.5 sm:gap-2 text-left min-w-0"
              title="SWITCHZ Overview"
            >
              <img
                src="/icon.svg"
                alt="SWITCHZ"
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-md border border-zinc-300 dark:border-white/15 shrink-0"
              />
              <span className="font-display font-bold text-[12.5px] sm:text-[15px] tracking-tight text-zinc-950 dark:text-zinc-50 whitespace-nowrap truncate">
                SWITCHZ
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
                  onClick={() => navigateRoute({ surface: 'desktop', tab: item.id })}
                  className={`relative px-2.5 lg:px-3 py-1.5 rounded-xl text-xs inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
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

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <ThemeToggle variant="header" />
            <span className="hidden min-[420px]:inline-flex">
              <PWAInstallButton variant="header" />
            </span>
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="w-7 h-7 sm:w-auto sm:h-9 px-0 sm:px-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center gap-2 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/25 transition-colors shrink-0"
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
              className="w-7 h-7 sm:w-auto sm:min-h-[36px] px-0 sm:px-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-950 dark:bg-zinc-50 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white transition-colors whitespace-nowrap shrink-0"
              aria-label="Create Agent Card"
              title="Create Agent Card"
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
              onEngageAgent={handleOpenEngage}
              onDialNumber={handleDialNumberString}
              onSwitchToDesktop={() => navigateRoute({ surface: 'desktop' })}
              onGoBack={handleGoBack}
            />
          </SwipeScrollArea>
        ) : activeTab === 'home' ? (
          <SwipeScrollArea direction="vertical" className="flex-1 min-h-0" innerClassName="pb-16">
            <MinimalLandingPage
              agentsCount={store.agents.length}
              openRolesCount={store.jobs.filter((j) => j.status === 'OPEN').length}
              onEnterDirectory={() => navigateRoute({ surface: 'desktop', tab: 'directory' })}
              onOpenQuickJobAgent={() => setQuickJobModalOpen(true)}
              onOpenQuickEmployerAgent={() => setQuickEmployerModalOpen(true)}
              onOpenLegalDoc={handleOpenLegalDoc}
              onNavigateTab={(tab) => navigateRoute({ surface: 'desktop', tab })}
            />
          </SwipeScrollArea>
        ) : activeTab === 'pricing' ? (
          <SwipeScrollArea direction="vertical" className="flex-1 min-h-0" innerClassName="pb-16">
            <PricingSection
              variant="page"
              onOpenQuickJobAgent={() => setQuickJobModalOpen(true)}
              onOpenQuickEmployerAgent={() => setQuickEmployerModalOpen(true)}
              onOpenHiringDesk={() => navigateRoute({ surface: 'desktop', tab: 'hiring' })}
              onOpenRegistry={() => navigateRoute({ surface: 'desktop', tab: 'registry' })}
              onOpenLegalDoc={handleOpenLegalDoc}
              onBackToOverview={() => navigateRoute({ surface: 'desktop', tab: 'home' })}
            />
          </SwipeScrollArea>
        ) : activeTab === 'legal' ? (
          <SwipeScrollArea direction="vertical" className="flex-1 min-h-0" innerClassName="pb-16">
            <LegalDocumentView
              activeDoc={legalDoc}
              onSelectDoc={handleOpenLegalDoc}
              onBack={handleGoBack}
              onCloseToDirectory={() => navigateRoute({ surface: 'desktop', tab: 'directory' })}
              onOpenPrivacyDesk={() => {
                setPoppyInitialRoleTab('seeker');
                navigateRoute({ surface: 'desktop', tab: 'hiring' });
              }}
            />
          </SwipeScrollArea>
        ) : activeTab === 'directory' ? (
          <DirectoryModule
            agents={store.agents}
            bookings={store.bookings}
            currency={store.currency}
            localCurrency={store.localCurrency}
            fxRates={store.fxRates}
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
            onSelectForEngage={handleOpenEngage}
            onDialAgent={handleOpenDialerForAgent}
            onEmailAgent={handleOpenEmailForAgent}
            onDeployAgent={store.addOrUpdateAgent}
            onToggleDiscoverable={store.toggleAgentDiscoverability}
            onOpenVideoStudio={handleOpenVideoStudioForAgent}
            onCustomizeCard={(agent) => setCustomizingAgent(agent)}
            onSaveContact={(agent) =>
              store.saveContact(agent, {
                source: 'directory',
                sharedAtLocation: agent.geoLocation?.label || 'Switchboard Directory',
              })
            }
            savedContactHandles={savedContactHandles}
            openDeployModalInitially={openDeployWizard}
            onCloseDeployModal={() => setOpenDeployWizard(false)}
            onOpenQuickJobAgent={() => setQuickJobModalOpen(true)}
            onOpenQuickEmployerAgent={() => setQuickEmployerModalOpen(true)}
            onOpenProfileHistory={(agent) => handleOpenProfileHistory(agent)}
            onOpenCompanyHr={handleOpenCompanyHr}
            statusPosts={store.statusPosts}
            onOpenPostStatus={() => setPostStatusModalOpen(true)}
          />
        ) : (
          <SwipeScrollArea direction="vertical" className="flex-1 min-h-0" innerClassName="pb-24 space-y-4">
            {activeTab === 'intent' && (
              <IntentProfilePage
                agents={store.agents}
                jobs={store.jobs}
                rfps={store.rfps}
                currency={store.currency}
                autonomousMatches={store.autonomousMatches}
                autonomousMatchLoading={store.autonomousMatchLoading}
                autonomousMatchMeta={store.autonomousMatchMeta}
                onUpdateIntent={store.updateAgentIntent}
                onRunAutonomousMatch={store.runAutonomousIntentMatch}
                onPublishRfp={store.publishRfp}
                onUpdateRfpStatus={store.updateRfpStatus}
                onCreateJob={store.createJob}
                onUpdateJobStatus={store.updateJobStatus}
                onEngageAgent={(targetHandle) => {
                  const target = resolveAgentByHandle(targetHandle);
                  handleOpenEngage(target);
                }}
                onApplyToJob={async (jobId, candidateAgent) => {
                  const targetJob = store.jobs.find((j) => j.id === jobId);
                  if (!targetJob) return;
                  await store.tailorAndSubmitApplication(candidateAgent, targetJob);
                  setPoppyInitialSeekerId(candidateAgent.id);
                  setPoppyInitialRoleTab('seeker');
                  navigateRoute({ surface: 'desktop', tab: 'hiring' });
                }}
                onPitchRfp={(rfp: RfpDoc, pitcherAgent: AgentDoc) => {
                  handleEngageProposal({
                    targetHandle: rfp.publisherHandle,
                    proposalTitle: `${rfp.title} — Pitch by ${pitcherAgent.displayName}`,
                    stickerPriceZAR: rfp.budgetZAR,
                  });
                }}
                onSaveContact={(item: AutonomousMatchItem) => {
                  const resolved = resolveAgentByHandle(item.targetHandle);
                  store.saveContact(resolved, {
                    source: item.kind === 'proximity_peer' ? 'event_ble' : 'directory',
                    sharedAtLocation: item.subtitle,
                    notes: `Matched via Autonomous Intent (${item.score}%): ${item.rationale}`,
                    tags: item.matchedKeywords.slice(0, 3),
                  });
                }}
                onOpenQuickPersonalUrlModal={() => setQuickJobModalOpen(true)}
                onOpenQuickCompanyUrlModal={() => setQuickEmployerModalOpen(true)}
                onOpenSpatialRadar={() =>
                  navigateRoute({ surface: 'desktop', tab: 'spatial', spatialSub: 'maps' })
                }
              />
            )}

            {activeTab === 'arena' && (
              <NegotiationArenaModule
                agents={store.agents}
                rfps={store.rfps}
                negotiations={store.negotiations}
                selectedTargetAgent={selectedEngageAgent}
                initialProposal={engageProposalPrefill}
                currency={store.currency}
                localCurrency={store.localCurrency}
                fxRates={store.fxRates}
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
                onOpenQuickJobAgent={() => setQuickJobModalOpen(true)}
                onOpenQuickEmployerAgent={() => setQuickEmployerModalOpen(true)}
                applicationPackages={store.applicationPackages}
                onTailorAndApply={store.tailorAndSubmitApplication}
                onOpenProfileHistory={handleOpenProfileHistory}
                onOpenCompanyHr={handleOpenCompanyHr}
              />
            )}

            {activeTab === 'registry' && (
              <RegistryMarketplaceModule
                claimedHandles={store.claimedHandles}
                auctions={store.auctions}
                secondaryListings={store.secondaryListings}
                currency={store.currency}
                localCurrency={store.localCurrency}
                locationLabel={store.locationLabel}
                fxRates={store.fxRates}
                fxSource={store.fxSource}
                detectingLocation={store.detectingLocation}
                ownerUid={store.currentUser.uid}
                ownerName={store.currentUser.displayName}
                onSelectCurrency={store.setCurrency}
                onSelectLocalCurrency={store.setLocalCurrency}
                onDetectLocation={store.detectLocationAndCurrency}
                onClaimHandle={store.claimHandleRecord}
                onPlaceBid={store.placeAuctionBid}
                onBuyoutListing={store.buyoutSecondaryListing}
              />
            )}

            {activeTab === 'spatial' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <SwipeScrollArea
                    direction="horizontal"
                    arrowSize="sm"
                    stepPx={160}
                    showArrows={true}
                    className="flex-1 min-w-0 sm:flex-initial sm:max-w-full rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 shadow-2xs"
                    innerClassName="inline-flex items-center gap-1 p-1 pl-2 pr-9"
                  >
                    <button
                      type="button"
                      onClick={() => navigateRoute({ spatialSub: 'maps' })}
                      className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 sm:px-3.5 text-xs whitespace-nowrap shrink-0 transition-colors ${
                        spatialSubView === 'maps'
                          ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                          : 'text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-950 dark:hover:text-zinc-100'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      Maps &amp; BLE Radar
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateRoute({ spatialSub: 'contacts' })}
                      className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 sm:px-3.5 text-xs whitespace-nowrap shrink-0 transition-colors ${
                        spatialSubView === 'contacts'
                          ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                          : 'text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-950 dark:hover:text-zinc-100'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      Contacts &amp; AI ({store.contacts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateRoute({ spatialSub: 'agentmail' })}
                      className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 sm:px-3.5 text-xs whitespace-nowrap shrink-0 transition-colors ${
                        spatialSubView === 'agentmail'
                          ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                          : 'text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-950 dark:hover:text-zinc-100'
                      }`}
                    >
                      <Bot className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      AgentMail
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateRoute({ spatialSub: 'comms' })}
                      className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 sm:px-3.5 text-xs whitespace-nowrap shrink-0 transition-colors ${
                        spatialSubView === 'comms'
                          ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                          : 'text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-950 dark:hover:text-zinc-100'
                      }`}
                    >
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      Mail &amp; Calendar
                    </button>
                  </SwipeScrollArea>

                  <button
                    type="button"
                    onClick={() => navigateRoute({ surface: 'desktop', tab: 'directory' })}
                    className="min-h-[36px] px-2.5 sm:px-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1.5 shrink-0"
                    aria-label="Close Radar & Contacts and return to Directory"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Close</span>
                  </button>
                </div>

                {spatialSubView === 'maps' ? (
                  <SpatialMapsDiscovery
                    agents={store.agents}
                    rfps={store.rfps}
                    jobs={store.jobs}
                    activeUserAgent={activeUserAgent}
                    savedContactHandles={savedContactHandles}
                    userLocation={store.userLocation}
                    onUpdateUserLocation={store.setUserLocation}
                    passerbyEvents={store.passerbyEvents}
                    onAddPasserbyEvent={store.addPasserbyEvent}
                    dispatchedUnits={store.dispatchedUnits}
                    googleMapsApiKey={store.googleMapsApiKey}
                    mapboxAccessToken={store.mapboxAccessToken}
                    currency={store.currency}
                    onEngageAgent={handleOpenEngage}
                    onEngageProposal={handleEngageProposal}
                    onSaveContact={store.saveContact}
                    onAutoAddPeers={store.autoAddProximityPeers}
                    onApplyJobFromRadar={handleApplyJobFromRadar}
                  />
                ) : spatialSubView === 'contacts' ? (
                  <ContactsHubModule
                    contacts={store.contacts}
                    agents={store.agents}
                    jobs={store.jobs}
                    rfps={store.rfps}
                    currency={store.currency}
                    ownerUid={store.currentUser.uid}
                    aiOpportunities={store.aiOpportunities}
                    aiOpportunitiesMeta={store.aiOpportunitiesMeta}
                    aiOpportunitiesLoading={store.aiOpportunitiesLoading}
                    aiOpportunitiesError={store.aiOpportunitiesError}
                    onSaveContact={store.saveContact}
                    onUpdateContact={store.updateContact}
                    onToggleFavorite={store.toggleContactFavorite}
                    onDeleteContact={store.deleteContact}
                    onScanOpportunities={(agent) => store.scanOpportunitiesWithAi(agent)}
                    onEngageProposal={handleEngageProposal}
                    onApplyJob={handleApplyJobFromRadar}
                    onDialHandle={handleDialByHandle}
                    onEmailHandle={handleEmailByHandle}
                    onSaveNegotiation={store.saveNegotiation}
                    onAddBooking={store.addBooking}
                  />
                ) : spatialSubView === 'agentmail' ? (
                  <AgentMailInboxModule
                    agents={store.agents}
                    onUpdateAgent={store.addOrUpdateAgent}
                    currency={store.currency}
                    ownerUid={store.currentUser.uid}
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
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <SwipeScrollArea
                    direction="horizontal"
                    arrowSize="sm"
                    showArrows={true}
                    stepPx={160}
                    className="flex-1 min-w-0 sm:flex-initial sm:max-w-full rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 shadow-2xs"
                    innerClassName="inline-flex items-center gap-1 p-1 pl-2 pr-9"
                  >
                    <button
                      type="button"
                      onClick={() => navigateRoute({ toolkitSub: 'skills' })}
                      className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 sm:px-3.5 text-xs whitespace-nowrap shrink-0 transition-colors ${
                        toolkitSubView === 'skills'
                          ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                          : 'text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-950 dark:hover:text-zinc-100'
                      }`}
                    >
                      <Bot className="w-3.5 h-3.5 shrink-0" />
                      Agent Skills
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateRoute({ toolkitSub: 'extension' })}
                      className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 sm:px-3.5 text-xs whitespace-nowrap shrink-0 transition-colors ${
                        toolkitSubView === 'extension'
                          ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                          : 'text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-950 dark:hover:text-zinc-100'
                      }`}
                    >
                      <Puzzle className="w-3.5 h-3.5 shrink-0" />
                      Extension
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateRoute({ toolkitSub: 'ledger' })}
                      className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 sm:px-3.5 text-xs whitespace-nowrap shrink-0 transition-colors ${
                        toolkitSubView === 'ledger'
                          ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                          : 'text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-950 dark:hover:text-zinc-100'
                      }`}
                    >
                      <Terminal className="w-3.5 h-3.5 shrink-0" />
                      Ledger
                    </button>
                  </SwipeScrollArea>

                  <button
                    type="button"
                    onClick={() => navigateRoute({ surface: 'desktop', tab: 'directory' })}
                    className="min-h-[36px] px-2.5 sm:px-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1.5 shrink-0"
                    aria-label="Close page and return to Directory"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Close</span>
                  </button>
                </div>

                {toolkitSubView === 'skills' ? (
                  <AgentSkillsPage />
                ) : toolkitSubView === 'extension' ? (
                  <ChromeExtensionHub
                    agents={store.agents}
                    currency={store.currency}
                    onTriggerEngageFromSim={handleOpenEngage}
                  />
                ) : (
                  <DeveloperLedgerModule
                    settlements={store.settlements}
                    poppyOperations={store.poppyOperations}
                    poppyAuditLogs={store.poppyAuditLogs}
                    currency={store.currency}
                    firestoreOnline={store.firestoreOnline}
                    hasGoogleMapsKey={Boolean(store.googleMapsApiKey)}
                    hasMapboxKey={Boolean(store.mapboxAccessToken)}
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

      {/* Consolidated Bottom Action Row (hidden on minimal landing & legal views) */}
      {activeTab !== 'home' && activeTab !== 'legal' && (
      <div className="fixed bottom-[68px] md:bottom-5 right-2 sm:right-5 left-2 sm:left-auto z-40 flex flex-col items-end gap-2 pointer-events-none">
        <AnimatePresence>
          {floatingMenuExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 shadow-2xl p-1.5 w-52 space-y-0.5"
            >
              {[
                {
                  label: networkAutopilot.config.enabled
                    ? '+Network Monitor'
                    : 'Configure +Network',
                  icon: Radio,
                  active: networkAutopilot.config.enabled,
                  onClick: () => {
                    setFloatingMenuExpanded(false);
                    setNetworkAutopilotModalOpen(true);
                  },
                },
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
                    navigateRoute({ surface: 'desktop', tab: 'directory' });
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

        <div className="w-full sm:w-auto flex flex-wrap items-center justify-end gap-1 sm:gap-2">
          {store.surface === 'desktop' && activeTab === 'directory' ? (
            <div className="pointer-events-auto flex items-center p-1 rounded-full bg-white/95 dark:bg-zinc-900/95 border border-zinc-300 dark:border-white/15 shadow-xl gap-1 max-w-full">
              <button
                type="button"
                onClick={() => {
                  setFloatingMenuExpanded(false);
                  networkAutopilot.toggleEnabled();
                }}
                aria-pressed={networkAutopilot.config.enabled}
                className={`h-8 sm:h-9 px-2 sm:px-3 rounded-full text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                  networkAutopilot.config.enabled
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                    : 'bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700'
                }`}
                title="Toggle persistent +Network autopilot: scans GPS, Wi-Fi & beacons in range, adds contacts per intents, and negotiates/closes deals"
              >
                <Radio className="w-3.5 h-3.5 shrink-0" />
                <span>{networkAutopilot.config.enabled ? 'Network On' : '+Network'}</span>
              </button>
              {networkAutopilot.config.enabled && (
                <button
                  type="button"
                  onClick={() => {
                    setFloatingMenuExpanded(false);
                    setNetworkAutopilotModalOpen(true);
                  }}
                  className="h-8 sm:h-9 px-2 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/70 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-500/30 text-[11px] font-mono font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
                  title="Inspect +Network live activity, contacts added, and closed deals"
                  aria-label="Open +Network Autopilot Details"
                >
                  <Activity className="w-3.5 h-3.5 shrink-0" />
                  <span className="tabular-nums">
                    {networkAutopilot.stats.contactsAdded + networkAutopilot.stats.dealsClosed}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setFloatingMenuExpanded(false);
                  setQuickJobModalOpen(true);
                }}
                className="h-8 sm:h-9 px-2 sm:px-3 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
                title="Paste LinkedIn URL for a free Job Agent + 10 matches"
              >
                <Linkedin className="w-3.5 h-3.5 shrink-0" />
                <span>Job Agent</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFloatingMenuExpanded(false);
                  setQuickEmployerModalOpen(true);
                }}
                className="h-8 sm:h-9 px-2 sm:px-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
                title="Paste Job URL for a 1-click Employer Agent + auto-match candidates"
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Hire with Agent</span>
                <span className="sm:hidden">Hire</span>
              </button>
            </div>
          ) : networkAutopilot.config.enabled ? (
            <div className="pointer-events-auto flex items-center p-1 rounded-full bg-white/95 dark:bg-zinc-900/95 border border-indigo-300 dark:border-indigo-500/40 shadow-xl gap-1">
              <button
                type="button"
                onClick={() => networkAutopilot.toggleEnabled()}
                aria-pressed={true}
                className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                title="+Network Autopilot is active in the background — click to pause"
              >
                <Radio className="w-3.5 h-3.5 shrink-0" />
                <span>Network On</span>
              </button>
              <button
                type="button"
                onClick={() => setNetworkAutopilotModalOpen(true)}
                className="h-8 sm:h-9 px-2.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-200 text-[11px] font-mono font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                title="View +Network live scan activity & closed deals"
              >
                <Activity className="w-3.5 h-3.5 shrink-0" />
                <span className="tabular-nums">
                  {networkAutopilot.stats.contactsAdded + networkAutopilot.stats.dealsClosed}
                </span>
              </button>
            </div>
          ) : null}

          {/* Single Consolidated Pill: Quick Menu + Predictive Dialer */}
          <div className="pointer-events-auto flex items-center p-1 rounded-full bg-white/95 dark:bg-zinc-900/95 border border-zinc-300 dark:border-white/15 shadow-xl gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setFloatingMenuExpanded((v) => !v)}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors ${
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
              className="h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-full bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white flex items-center gap-1.5 text-xs font-semibold transition-transform active:scale-95"
              aria-label="Open Predictive Dialer"
              title="Predictive Dialer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dial</span>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden min-h-[56px] pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] shrink-0 z-40 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md border-t border-zinc-200 dark:border-white/[0.08] grid grid-cols-6 items-center px-0.5"
      >
        {PRIMARY_NAV_TABS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id && store.surface === 'desktop';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                navigateRoute({ surface: 'desktop', tab: item.id });
              }}
              className={`relative min-h-[44px] min-w-0 flex flex-col items-center justify-center gap-0.5 text-[9.5px] transition-colors ${
                isActive
                  ? 'text-zinc-950 dark:text-white font-semibold'
                  : 'text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 w-5 h-0.5 rounded-full bg-zinc-950 dark:bg-white" aria-hidden="true" />
              )}
              <span className="relative">
                <Icon className="w-[17px] h-[17px]" />
                {item.id === 'hiring' && pendingPoppyCount > 0 && (
                  <span className="absolute -top-1 -right-2 w-3.5 h-3.5 rounded-full bg-amber-400 text-zinc-950 text-[8px] font-mono font-bold inline-flex items-center justify-center">
                    {pendingPoppyCount}
                  </span>
                )}
              </span>
              <span className="leading-none truncate max-w-full px-0.5">{item.mobileLabel}</span>
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
        localCurrency={store.localCurrency}
        locationLabel={store.locationLabel}
        fxRates={store.fxRates}
        agentsCount={store.agents.length}
        contactsCount={store.contacts.length}
        openRfpCount={openRfpCount}
        totalSavedZAR={totalSavedZAR}
        settlementsCount={store.settlements.length}
        userMode={store.currentUser.mode}
        userDisplayName={store.currentUser.displayName}
        onNavigate={handleDrawerNavigate}
        onSetSurface={(s) => navigateRoute({ surface: s })}
        onSetCurrency={store.setCurrency}
        onSetLocalCurrency={store.setLocalCurrency}
        onDetectLocation={store.detectLocationAndCurrency}
        onLoginGoogle={store.loginGoogle}
        onLoginPasskey={store.loginPasskeySim}
        onLogout={store.logout}
        onResetDemo={store.resetDemoData}
        onOpenQuickJobAgent={() => setQuickJobModalOpen(true)}
        onOpenQuickEmployerAgent={() => setQuickEmployerModalOpen(true)}
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
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-200 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  if (commandQuery) {
                    setCommandQuery('');
                  } else {
                    setCommandOpen(false);
                  }
                }}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0"
                aria-label={commandQuery ? 'Clear search' : 'Back'}
                title={commandQuery ? 'Clear search' : 'Back'}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <Search className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Search agents, jobs, RFPs, contacts, or intent topics..."
                className="flex-1 min-h-[32px] bg-transparent text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center shrink-0"
                aria-label="Close Quick Search"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <SwipeScrollArea direction="vertical" className="max-h-80" innerClassName="p-2 space-y-1">
              {!commandQ && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setCommandOpen(false);
                      setNetworkAutopilotModalOpen(true);
                    }}
                    className="w-full min-h-[42px] text-left rounded-lg px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-between"
                  >
                    <span className="font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                      <Radio className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> +Network Autonomous Scanner &amp; Deal Closer
                    </span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">
                      {networkAutopilot.config.enabled ? 'ACTIVE' : 'OFF'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigateRoute({ surface: 'desktop', tab: 'intent' });
                      setCommandOpen(false);
                    }}
                    className="w-full min-h-[42px] text-left rounded-lg px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-between"
                  >
                    <span className="font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                      <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Intent Profile &amp; Autonomous AI Matcher
                    </span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">/intent</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCommandOpen(false);
                      setQuickJobModalOpen(true);
                    }}
                    className="w-full min-h-[42px] text-left rounded-lg px-3 py-2 text-xs hover:bg-sky-50 dark:hover:bg-sky-950/40 flex items-center justify-between"
                  >
                    <span className="font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-sky-600 dark:text-sky-400" /> 1-Click URL → Personal Job Agent
                    </span>
                    <span className="font-mono text-sky-600 dark:text-sky-400">Auto-Match</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCommandOpen(false);
                      setQuickEmployerModalOpen(true);
                    }}
                    className="w-full min-h-[42px] text-left rounded-lg px-3 py-2 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-between"
                  >
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> 1-Click Company Agent &amp; Vacancies
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">Auto-Match</span>
                  </button>

                  {openAiCompanyAgent && (
                    <button
                      type="button"
                      onClick={() => {
                        setCommandOpen(false);
                        handleOpenCompanyHr(openAiCompanyAgent);
                      }}
                      className="w-full min-h-[42px] text-left rounded-lg px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-between"
                    >
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-500" /> OpenAI HR Portal (Roles &amp; Top Appliers)
                      </span>
                      <span className="font-mono text-amber-600 dark:text-amber-400">HR Portal</span>
                    </button>
                  )}

                  {activeUserAgent && (
                    <button
                      type="button"
                      onClick={() => {
                        setCommandOpen(false);
                        handleOpenProfileHistory(activeUserAgent);
                      }}
                      className="w-full min-h-[42px] text-left rounded-lg px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-between"
                    >
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <History className="w-4 h-4 text-sky-500" /> Personal Agent History &amp; PDF/DOCX Docs
                      </span>
                      <span className="font-mono text-sky-600 dark:text-sky-400">
                        {store.applicationPackages.length} Docs
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setCommandOpen(false);
                      setPostStatusModalOpen(true);
                    }}
                    className="w-full min-h-[42px] text-left rounded-lg px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-between"
                  >
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-500" /> Post Status Card
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {store.statusPosts.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigateRoute({ surface: 'desktop', tab: 'toolkit', toolkitSub: 'skills' });
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
                      navigateRoute({ surface: 'desktop', tab: 'spatial', spatialSub: 'contacts' });
                      setCommandOpen(false);
                    }}
                    className="w-full min-h-[42px] text-left rounded-lg px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-between"
                  >
                    <span className="font-medium text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Contacts &amp; AI Scout
                    </span>
                    <span className="font-mono text-zinc-500">{store.contacts.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigateRoute({ surface: 'desktop', tab: 'toolkit', toolkitSub: 'ledger' });
                      setCommandOpen(false);
                    }}
                    className="w-full min-h-[42px] text-left rounded-lg px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-between"
                  >
                    <span className="font-medium text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Audit Ledger &amp; OpenAPI
                    </span>
                    <span className="font-mono text-zinc-500">x402</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigateRoute({ surface: 'desktop', tab: 'home' });
                      setCommandOpen(false);
                    }}
                    className="w-full min-h-[42px] text-left rounded-lg px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-between"
                  >
                    <span className="font-medium text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
                      <Home className="w-4 h-4 text-zinc-600 dark:text-zinc-400" /> SWITCHZ Overview (Landing Page)
                    </span>
                    <span className="font-mono text-zinc-500">/</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleOpenLegalDoc('terms');
                      setCommandOpen(false);
                    }}
                    className="w-full min-h-[42px] text-left rounded-lg px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-between"
                  >
                    <span className="font-medium text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
                      <Scale className="w-4 h-4 text-zinc-600 dark:text-zinc-400" /> Global Platform Terms of Use
                    </span>
                    <span className="font-mono text-zinc-500">/term</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleOpenLegalDoc('privacy');
                      setCommandOpen(false);
                    }}
                    className="w-full min-h-[42px] text-left rounded-lg px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-between"
                  >
                    <span className="font-medium text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Privacy Policy &amp; Candidate AI Notice
                    </span>
                    <span className="font-mono text-zinc-500">/terms</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleOpenLegalDoc('employer');
                      setCommandOpen(false);
                    }}
                    className="w-full min-h-[42px] text-left rounded-lg px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-between"
                  >
                    <span className="font-medium text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Employer Recruitment Fee Agreement
                    </span>
                    <span className="font-mono text-zinc-500">/employeragreement</span>
                  </button>
                </>
              )}

              {commandJobs.length > 0 && (
                <div className="pt-1.5">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Open Vacancies ({commandJobs.length})
                  </div>
                  {commandJobs.map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => {
                        setPoppyInitialRoleTab('seeker');
                        navigateRoute({ surface: 'desktop', tab: 'hiring' });
                        setCommandOpen(false);
                      }}
                      className="w-full min-h-[42px] text-left rounded-lg px-3 py-2 text-xs hover:bg-sky-50 dark:hover:bg-sky-950/30 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-950 dark:text-white truncate">{job.title}</p>
                        <p className="text-[11px] text-zinc-500 truncate">
                          {job.companyName} · {job.remoteMode} · {formatMoney(job.salaryRangeZAR[1], store.currency)}
                        </p>
                      </div>
                      <Briefcase className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {commandRfps.length > 0 && (
                <div className="pt-1.5">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Requests for Proposal ({commandRfps.length})
                  </div>
                  {commandRfps.map((rfp) => (
                    <button
                      key={rfp.id}
                      type="button"
                      onClick={() => {
                        handleEngageProposal({
                          targetHandle: rfp.publisherHandle,
                          proposalTitle: `Proposal for ${rfp.title}`,
                          stickerPriceZAR: rfp.budgetZAR,
                        });
                        setCommandOpen(false);
                      }}
                      className="w-full min-h-[42px] text-left rounded-lg px-3 py-2 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-950 dark:text-white truncate">{rfp.title}</p>
                        <p className="text-[11px] text-zinc-500 font-mono truncate">
                          {rfp.publisherHandle} · {formatMoney(rfp.budgetZAR, store.currency)} · {rfp.status}
                        </p>
                      </div>
                      <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {commandContacts.length > 0 && (
                <div className="pt-1.5">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Saved Contacts ({commandContacts.length})
                  </div>
                  {commandContacts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        navigateRoute({ surface: 'desktop', tab: 'spatial', spatialSub: 'contacts' });
                        setCommandOpen(false);
                      }}
                      className="w-full min-h-[42px] text-left rounded-lg px-3 py-2 text-xs hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-950 dark:text-white truncate">{c.displayName}</p>
                        <p className="text-[11px] font-mono text-zinc-500 truncate">{c.handle} · {c.organization}</p>
                      </div>
                      <Users className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              <div className="pt-1.5">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Personal &amp; Business Agents ({commandAgents.length})
                </div>
                {commandAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="w-full min-h-[44px] rounded-lg px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenEngage(agent);
                        setCommandOpen(false);
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="font-semibold text-zinc-950 dark:text-white truncate">
                        {agent.displayName} <span className="text-[10px] font-normal text-zinc-500">· {agent.roleTitle}</span>
                      </p>
                      <p className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
                        {agent.handle}
                        {agent.impliedIntent?.headline ? ` · ${agent.impliedIntent.headline}` : ''}
                      </p>
                    </button>
                    {agent.handle !== '911.emergency.agent' && (
                      <button
                        type="button"
                        onClick={() =>
                          store.saveContact(agent, {
                            source: 'directory',
                            sharedAtLocation: 'Global Search',
                          })
                        }
                        title="Add to Contacts"
                        className="p-1.5 rounded-md border border-zinc-200 dark:border-white/10 text-zinc-500 hover:text-emerald-600 shrink-0"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenEngage(agent);
                        setCommandOpen(false);
                      }}
                      title="Engage Agent"
                      className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-950 dark:hover:text-white shrink-0"
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
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

      <QuickJobAgentModal
        open={quickJobModalOpen}
        onClose={() => setQuickJobModalOpen(false)}
        jobs={store.jobs}
        currency={store.currency}
        ownerUid={store.currentUser.uid}
        onCreateAgent={store.addOrUpdateAgent}
        onUpsertMatchesBulk={store.upsertRecruitmentMatchesBulk}
        onAddConsentGrant={store.addConsentGrant}
        onProposeOperation={store.proposePoppyOperation}
        onExecuteOperation={store.executePoppyOperation}
        onAddBooking={store.addBooking}
        onLogAudit={store.logPoppyAudit}
        onOpenHiringDesk={(agentId) => {
          setPoppyInitialSeekerId(agentId);
          setPoppyInitialRoleTab('seeker');
          navigateRoute({ surface: 'desktop', tab: 'hiring' });
        }}
        onTailorAndApply={store.tailorAndSubmitApplication}
        onOpenProfileHistory={(agent, pkgId) => {
          setQuickJobModalOpen(false);
          handleOpenProfileHistory(agent, pkgId);
        }}
        onOpenLegal={handleOpenLegalDoc}
      />

      <QuickEmployerAgentModal
        open={quickEmployerModalOpen}
        onClose={() => setQuickEmployerModalOpen(false)}
        candidates={store.agents}
        currency={store.currency}
        ownerUid={store.currentUser.uid}
        onCreateAgent={store.addOrUpdateAgent}
        onCreateJobsBulk={store.createJobsBulk}
        onUpsertMatchesBulk={store.upsertRecruitmentMatchesBulk}
        onProposeOperation={store.proposePoppyOperation}
        onExecuteOperation={store.executePoppyOperation}
        onAddBooking={store.addBooking}
        onLogAudit={store.logPoppyAudit}
        onOpenHiringDesk={() => {
          setPoppyInitialRoleTab('hiring');
          navigateRoute({ surface: 'desktop', tab: 'hiring' });
        }}
        onOpenLegal={handleOpenLegalDoc}
      />

      <AgentProfileHistoryModal
        open={profileHistoryState.open}
        onClose={() => setProfileHistoryState({ open: false, agent: null, packageId: null })}
        agent={profileHistoryState.agent || activeUserAgent}
        allPersonas={store.agents.filter((a) => a.type === 'persona')}
        onSelectAgent={(next) =>
          setProfileHistoryState((prev) => ({ ...prev, agent: next, packageId: null }))
        }
        jobs={store.jobs}
        matches={store.matches}
        applicationPackages={store.applicationPackages}
        history={store.agentActionHistory}
        currency={store.currency}
        initialPackageId={profileHistoryState.packageId}
        onTailorAndApply={store.tailorAndSubmitApplication}
        onLogHistory={store.logAgentHistory}
        onUpdateIntent={store.updateAgentIntent}
        onOpenIntentHub={() => {
          setProfileHistoryState((prev) => ({ ...prev, open: false }));
          navigateRoute({ surface: 'desktop', tab: 'intent' });
        }}
      />

      <CompanyHrPortalModal
        open={Boolean(hrPortalAgent)}
        onClose={() => setHrPortalAgent(null)}
        companyAgent={hrPortalAgent}
        allBusinessAgents={store.agents.filter(
          (a) => a.type === 'business' && a.handle !== '911.emergency.agent'
        )}
        onSelectCompany={(next) => setHrPortalAgent(next)}
        allAgents={store.agents}
        jobs={store.jobs}
        matches={store.matches}
        applicationPackages={store.applicationPackages}
        history={store.agentActionHistory}
        currency={store.currency}
        onRecordHrDocView={store.recordHrDocView}
        onAddHrNote={store.addHrReviewNote}
        onUpdateApplicationStatus={store.updateApplicationStatus}
        onAddHrTeamMember={store.addHrTeamMember}
        onLogHistory={store.logAgentHistory}
        rfps={store.rfps}
        onPublishRfp={store.publishRfp}
        onCreateJob={store.createJob}
        onOpenIntentHub={() => {
          setHrPortalAgent(null);
          navigateRoute({ surface: 'desktop', tab: 'intent' });
        }}
      />

      <PostStatusModal
        open={postStatusModalOpen}
        onClose={() => setPostStatusModalOpen(false)}
        agents={store.agents}
        defaultAgent={activeUserAgent}
        currency={store.currency}
        onPublishStatus={store.createStatusPost}
      />

      <NetworkAutopilotModal
        open={networkAutopilotModalOpen}
        onClose={() => setNetworkAutopilotModalOpen(false)}
        agent={activeUserAgent}
        currency={store.currency}
        config={networkAutopilot.config}
        stats={networkAutopilot.stats}
        activityLog={networkAutopilot.activityLog}
        isScanning={networkAutopilot.isScanning}
        gpsStatus={networkAutopilot.gpsStatus}
        wifiMeshConnected={networkAutopilot.wifiMeshConnected}
        blePairedBeacon={networkAutopilot.blePairedBeacon}
        lastScanAt={networkAutopilot.lastScanAt}
        onToggleEnabled={networkAutopilot.toggleEnabled}
        onUpdateConfig={networkAutopilot.updateConfig}
        onRunCycleNow={networkAutopilot.runCycleNow}
        onPairBleBeacon={networkAutopilot.pairBleBeacon}
        onOpenContacts={() =>
          navigateRoute({ surface: 'desktop', tab: 'spatial', spatialSub: 'contacts' })
        }
        onOpenIntentHub={() => navigateRoute({ surface: 'desktop', tab: 'intent' })}
        onOpenArena={() => navigateRoute({ surface: 'desktop', tab: 'arena' })}
      />

      <ToastViewport />
      <OfflineIndicator />
    </div>
  );
}
