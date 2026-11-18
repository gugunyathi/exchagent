import React, { useEffect, useMemo, useState } from 'react';
import {
  AgentDoc,
  AgentIntentProfile,
  AutonomousMatchItem,
  BroadcastChannel,
  CurrencyMode,
  IntentCategory,
  JobPostingDoc,
  ProximityPeerDoc,
  RfpDoc,
  formatMoney,
  zarToUsd,
} from '../types/firestore';
import { SwipeScrollArea } from './SwipeScrollArea';
import { emitToast } from '../lib/toast';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Compass,
  FileText,
  Globe2,
  Link2,
  Loader2,
  Megaphone,
  Plus,
  Radar,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  UserCheck,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';

interface IntentProfilePageProps {
  agents: AgentDoc[];
  jobs: JobPostingDoc[];
  rfps: RfpDoc[];
  currency: CurrencyMode;
  autonomousMatches: AutonomousMatchItem[];
  autonomousMatchLoading: boolean;
  autonomousMatchMeta: {
    engine?: string;
    generatedAt?: string;
    executiveSummary?: string;
    sourceHandle?: string;
  } | null;
  onUpdateIntent: (agentId: string, intent: AgentIntentProfile) => Promise<AgentDoc | null>;
  onRunAutonomousMatch: (agent: AgentDoc, peers?: ProximityPeerDoc[]) => Promise<AutonomousMatchItem[] | null>;
  onPublishRfp: (rfp: RfpDoc) => Promise<void>;
  onUpdateRfpStatus: (rfpId: string, status: RfpDoc['status']) => void;
  onCreateJob: (job: JobPostingDoc) => void;
  onUpdateJobStatus: (jobId: string, status: JobPostingDoc['status']) => void;
  onEngageAgent: (targetHandle: string) => void;
  onApplyToJob: (jobId: string, candidateAgent: AgentDoc) => void;
  onPitchRfp: (rfp: RfpDoc, pitcherAgent: AgentDoc) => void;
  onSaveContact: (item: AutonomousMatchItem) => void;
  onOpenQuickPersonalUrlModal: () => void;
  onOpenQuickCompanyUrlModal: () => void;
  onOpenSpatialRadar: () => void;
}

const INTENT_CATEGORY_META: Array<{ id: IntentCategory; label: string; desc: string }> = [
  { id: 'career_role', label: 'Career & Hiring', desc: 'Target roles or open talent seats' },
  { id: 'commercial_deal', label: 'Commercial Deals', desc: 'Retainers, B2B sales & services' },
  { id: 'rfp_sourcing', label: 'RFPs & Vendors', desc: 'Requests for proposal & procurement' },
  { id: 'partnership', label: 'Partnerships', desc: 'Co-marketing, resellers & JVs' },
  { id: 'investment', label: 'Capital & Advisory', desc: 'Angel, seed rounds & board seats' },
  { id: 'event_networking', label: 'Live Events & BLE', desc: 'Summit Wi-Fi & compass discovery' },
];

const DEFAULT_INTENT = (agent: AgentDoc): AgentIntentProfile =>
  agent.impliedIntent || {
    categories:
      agent.type === 'business'
        ? ['rfp_sourcing', 'career_role', 'commercial_deal']
        : ['career_role', 'commercial_deal', 'event_networking'],
    headline:
      agent.type === 'business'
        ? `Seeking verified partners & specialists aligned with ${agent.organization}`
        : `Seeking roles, commercial retainers & collaborations aligned with ${agent.roleTitle}`,
    desiredOutcomes:
      agent.cvSummary?.preferredRoles?.length
        ? agent.cvSummary.preferredRoles
        : [agent.roleTitle],
    topics: agent.skills?.length ? agent.skills : ['AI Operations', 'B2B Growth'],
    targetBudgetMinZAR: agent.cvSummary?.salaryMinZAR || 85000,
    targetBudgetMaxZAR: agent.guardrails?.maxAutoSpendZAR || 250000,
    preferredRemoteModes: ['Remote', 'Hybrid'],
    maxDistanceMeters: agent.geoLocation?.radiusMeters || 150,
    autoMatchEnabled: true,
    autoAddProximityContacts: agent.type === 'persona',
    requireTopicOverlapForAutoAdd: false,
    updatedAt: new Date().toISOString(),
  };

export const IntentProfilePage: React.FC<IntentProfilePageProps> = ({
  agents,
  jobs,
  rfps,
  currency,
  autonomousMatches,
  autonomousMatchLoading,
  autonomousMatchMeta,
  onUpdateIntent,
  onRunAutonomousMatch,
  onPublishRfp,
  onUpdateRfpStatus,
  onCreateJob,
  onUpdateJobStatus,
  onEngageAgent,
  onApplyToJob,
  onPitchRfp,
  onSaveContact,
  onOpenQuickPersonalUrlModal,
  onOpenQuickCompanyUrlModal,
  onOpenSpatialRadar,
}) => {
  const selectableAgents = useMemo(
    () => agents.filter((a) => a.handle !== '911.emergency.agent'),
    [agents]
  );

  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    () => selectableAgents[0]?.id || ''
  );

  const selectedAgent = useMemo(
    () => selectableAgents.find((a) => a.id === selectedAgentId) || selectableAgents[0],
    [selectableAgents, selectedAgentId]
  );

  const [draftIntent, setDraftIntent] = useState<AgentIntentProfile>(() =>
    selectedAgent ? DEFAULT_INTENT(selectedAgent) : DEFAULT_INTENT(agents[0])
  );
  const [newTopic, setNewTopic] = useState('');
  const [newOutcome, setNewOutcome] = useState('');
  const [matchFilter, setMatchFilter] = useState<'all' | 'job' | 'rfp' | 'agent' | 'proximity_peer'>('all');

  // Company Intent: inline RFP & Vacancy forms
  const [companyFormMode, setCompanyFormMode] = useState<'rfp' | 'vacancy'>('rfp');
  const [rfpTitle, setRfpTitle] = useState('');
  const [rfpCategory, setRfpCategory] = useState('AI & Cloud Infrastructure');
  const [rfpBudgetZAR, setRfpBudgetZAR] = useState(180000);
  const [rfpDescription, setRfpDescription] = useState('');
  const [rfpChannels, setRfpChannels] = useState<BroadcastChannel[]>(['directory', 'google_maps_billboard', 'ble_beacon']);
  const [submittingRfp, setSubmittingRfp] = useState(false);

  const [jobTitle, setJobTitle] = useState('');
  const [jobDept, setJobDept] = useState('Engineering & AI');
  const [jobLocation, setJobLocation] = useState('Sandton / Remote');
  const [jobRemote, setJobRemote] = useState<'Remote' | 'Hybrid' | 'On-Site'>('Hybrid');
  const [jobSalaryMin, setJobSalaryMin] = useState(85000);
  const [jobSalaryMax, setJobSalaryMax] = useState(145000);
  const [jobSkillsText, setJobSkillsText] = useState('TypeScript, AI Agents, Growth Systems');
  const [jobDesc, setJobDesc] = useState('');

  useEffect(() => {
    if (!selectedAgent) return;
    setDraftIntent(DEFAULT_INTENT(selectedAgent));
    if (autonomousMatchMeta?.sourceHandle !== selectedAgent.handle) {
      void onRunAutonomousMatch(selectedAgent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgent?.id]);

  const companyJobs = useMemo(
    () =>
      selectedAgent
        ? jobs.filter((j) => j.companyAgentHandle === selectedAgent.handle)
        : [],
    [jobs, selectedAgent]
  );

  const companyRfps = useMemo(
    () =>
      selectedAgent
        ? rfps.filter((r) => r.publisherHandle === selectedAgent.handle)
        : [],
    [rfps, selectedAgent]
  );

  const visibleMatches = useMemo(
    () =>
      autonomousMatches.filter((m) =>
        matchFilter === 'all' ? true : m.kind === matchFilter
      ),
    [autonomousMatches, matchFilter]
  );

  if (!selectedAgent) return null;

  const toggleCategory = (cat: IntentCategory) => {
    setDraftIntent((prev) => {
      const exists = prev.categories.includes(cat);
      const next = exists
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat];
      return { ...prev, categories: next.length ? next : [cat] };
    });
  };

  const toggleRemoteMode = (mode: 'Remote' | 'Hybrid' | 'On-Site') => {
    setDraftIntent((prev) => {
      const curr = prev.preferredRemoteModes || [];
      const exists = curr.includes(mode);
      const next = exists ? curr.filter((m) => m !== mode) : [...curr, mode];
      return { ...prev, preferredRemoteModes: next.length ? next : [mode] };
    });
  };

  const handleAddTopic = () => {
    const clean = newTopic.trim();
    if (!clean) return;
    if (!draftIntent.topics.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setDraftIntent((prev) => ({ ...prev, topics: [...prev.topics, clean] }));
    }
    setNewTopic('');
  };

  const handleAddOutcome = () => {
    const clean = newOutcome.trim();
    if (!clean) return;
    setDraftIntent((prev) => ({
      ...prev,
      desiredOutcomes: [...prev.desiredOutcomes, clean],
    }));
    setNewOutcome('');
  };

  const handleSaveAndRunMatch = async () => {
    const updated = await onUpdateIntent(selectedAgent.id, draftIntent);
    await onRunAutonomousMatch(updated || { ...selectedAgent, impliedIntent: draftIntent });
  };

  const handleCreateCompanyRfp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rfpTitle.trim()) {
      emitToast('Please enter an RFP title.', 'warning');
      return;
    }
    setSubmittingRfp(true);
    try {
      const budgetZAR = Number(rfpBudgetZAR) || 120000;
      const newRfp: RfpDoc = {
        id: `rfp_${Date.now()}`,
        publisherAgentId: selectedAgent.id,
        publisherOwnerUid: selectedAgent.ownerUid,
        publisherHandle: selectedAgent.handle,
        title: rfpTitle.trim(),
        description:
          rfpDescription.trim() ||
          `${selectedAgent.organization} is requesting autonomous vendor & specialist proposals for ${rfpTitle.trim()}.`,
        budgetZAR,
        budgetUSD: zarToUsd(budgetZAR),
        category: rfpCategory.trim() || 'Enterprise Services',
        broadcastChannels: rfpChannels.length ? rfpChannels : ['directory'],
        status: 'OPEN',
        expiresAt: new Date(Date.now() + 14 * 86400000).toISOString(),
        matchedProposalsCount: 0,
      };
      await onPublishRfp(newRfp);
      setRfpTitle('');
      setRfpDescription('');
      await onRunAutonomousMatch(selectedAgent);
    } finally {
      setSubmittingRfp(false);
    }
  };

  const handleCreateCompanyVacancy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim()) {
      emitToast('Please enter a vacancy role title.', 'warning');
      return;
    }
    const parsedSkills = jobSkillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const minSal = Number(jobSalaryMin) || 75000;
    const maxSal = Math.max(minSal, Number(jobSalaryMax) || 130000);
    const newJob: JobPostingDoc = {
      id: `job_${Date.now()}`,
      companyAgentHandle: selectedAgent.handle,
      companyName: selectedAgent.organization || selectedAgent.displayName,
      title: jobTitle.trim(),
      department: jobDept.trim() || 'Operations',
      location: jobLocation.trim() || 'Remote Global',
      remoteMode: jobRemote,
      salaryRangeZAR: [minSal, maxSal],
      requiredSkills: parsedSkills.length ? parsedSkills : ['Execution', 'Domain Fit'],
      minYearsExp: 3,
      description:
        jobDesc.trim() ||
        `${selectedAgent.organization} is hiring ${jobTitle.trim()} (${jobRemote}) with autonomous Poppy pre-screening.`,
      status: 'OPEN',
      autonomyLevel: 'shortlist_auto_offer_approve',
      careersUrl: selectedAgent.careersUrl || `https://${selectedAgent.handle}/careers`,
      poppyDiscoveryPath: `/companies/${selectedAgent.handle.replace('.agent', '')}/.well-known/poppy.json`,
      weights: { skills: 40, experience: 25, compensation: 20, location: 15 },
      createdAt: new Date().toISOString(),
    };
    onCreateJob(newJob);
    setJobTitle('');
    setJobDesc('');
    await onRunAutonomousMatch(selectedAgent);
  };

  const toggleRfpChannel = (ch: BroadcastChannel) => {
    setRfpChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <Target className="w-3.5 h-3.5" />
              Intent & Autonomous AI Matching Engine
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Implied Intent Profile & Opportunity Autopilot
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl">
              {selectedAgent.type === 'business'
                ? 'Companies express commercial and hiring intent by publishing Requests for Proposal (RFPs) and Vacancies—agents automatically match vetted talent & vendors.'
                : 'Professionals declare career, deal, and event networking intent so personal agents autonomously match open vacancies, RFPs, and nearby radar peers.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenQuickPersonalUrlModal}
              className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white inline-flex items-center gap-1.5 transition-colors"
            >
              <Link2 className="w-3.5 h-3.5 text-sky-500" />
              URL → Personal Agent
            </button>
            <button
              type="button"
              onClick={onOpenQuickCompanyUrlModal}
              className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white inline-flex items-center gap-1.5 transition-colors"
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-500" />
              URL → Company Agent
            </button>
            <button
              type="button"
              onClick={onOpenSpatialRadar}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 text-xs font-semibold inline-flex items-center gap-1.5 transition-opacity"
            >
              <Radar className="w-3.5 h-3.5" />
              Event Radar & Auto-Add
            </button>
          </div>
        </div>

        {/* Agent Selector Strip (no native grey scrollbar) */}
        <div className="mt-5 pt-4 border-t border-zinc-200/80 dark:border-zinc-800">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
            Active Identity Context ({selectableAgents.length} Verified Agents)
          </div>
          <SwipeScrollArea direction="horizontal" showArrows arrowSize="sm" className="w-full" innerClassName="flex items-center gap-2 py-1 px-1">
            {selectableAgents.map((agent) => {
              const active = agent.id === selectedAgent.id;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`shrink-0 px-3 py-2 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                    active
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 border-zinc-900 dark:border-white shadow-sm'
                      : 'bg-zinc-50 dark:bg-zinc-950/70 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      agent.type === 'business'
                        ? active
                          ? 'bg-emerald-500 text-white'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : active
                        ? 'bg-sky-500 text-white'
                        : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                    }`}
                  >
                    {agent.type === 'business' ? <Building2 className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate max-w-[140px]">{agent.displayName}</div>
                    <div className={`text-[10px] font-mono truncate max-w-[140px] ${active ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500'}`}>
                      {agent.handle}
                    </div>
                  </div>
                </button>
              );
            })}
          </SwipeScrollArea>
        </div>
      </div>

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Implied Intent Editor (+ Company RFPs & Vacancies Manager) */}
        <div className="xl:col-span-5 space-y-6">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-5 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  {selectedAgent.type === 'business' ? 'Company Intent Settings' : 'Personal Intent Profile'}
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Signals what {selectedAgent.displayName} wants to match automatically
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                {selectedAgent.type === 'business' ? 'BUSINESS' : 'PERSONAL'}
              </span>
            </div>

            {/* Intent Categories */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                Implied Intent Signal Categories
              </label>
              <div className="grid grid-cols-2 gap-2">
                {INTENT_CATEGORY_META.map((cat) => {
                  const selected = draftIntent.categories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        selected
                          ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-700 dark:text-indigo-300'
                          : 'bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold">{cat.label}</span>
                        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                      </div>
                      <div className="text-[10px] opacity-80 mt-0.5 line-clamp-1">{cat.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Intent Headline */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Intent Headline (Searched by Agents & Radar)
              </label>
              <textarea
                rows={2}
                value={draftIntent.headline}
                onChange={(e) => setDraftIntent((p) => ({ ...p, headline: e.target.value }))}
                placeholder="e.g., Open to Head of Growth roles, B2B AI retainers & fintech collaborations..."
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Implied Topics / Skills */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Matching Topics, Skills & Keywords
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {draftIntent.topics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700"
                  >
                    {topic}
                    <button
                      type="button"
                      onClick={() =>
                        setDraftIntent((p) => ({
                          ...p,
                          topics: p.topics.filter((t) => t !== topic),
                        }))
                      }
                      aria-label={`Remove ${topic}`}
                      className="text-zinc-400 hover:text-rose-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTopic();
                    }
                  }}
                  placeholder="Add topic (e.g. Zero-Trust, SaaS, Solar RFP)"
                  className="flex-1 min-w-0 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddTopic}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold shrink-0 inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>

            {/* Desired Outcomes */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Specific Target Outcomes / Roles
              </label>
              <div className="space-y-1.5 mb-2">
                {draftIntent.desiredOutcomes.map((out, idx) => (
                  <div
                    key={`${out}-${idx}`}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300"
                  >
                    <span className="truncate">{out}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftIntent((p) => ({
                          ...p,
                          desiredOutcomes: p.desiredOutcomes.filter((_, i) => i !== idx),
                        }))
                      }
                      aria-label="Remove outcome"
                      className="text-zinc-400 hover:text-rose-500 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newOutcome}
                  onChange={(e) => setNewOutcome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOutcome();
                    }
                  }}
                  placeholder="Add target outcome or collaboration goal"
                  className="flex-1 min-w-0 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddOutcome}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 shrink-0"
                >
                  + Goal
                </button>
              </div>
            </div>

            {/* Budget / Compensation & Work Modes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Target Min (ZAR · {formatMoney(draftIntent.targetBudgetMinZAR || 0, currency)})
                </label>
                <input
                  type="number"
                  value={draftIntent.targetBudgetMinZAR || 0}
                  onChange={(e) =>
                    setDraftIntent((p) => ({ ...p, targetBudgetMinZAR: Number(e.target.value) || 0 }))
                  }
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-1.5 text-xs font-mono tabular-nums text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Radar Radius ({draftIntent.maxDistanceMeters || 150}m)
                </label>
                <input
                  type="range"
                  min={20}
                  max={500}
                  step={10}
                  value={draftIntent.maxDistanceMeters || 150}
                  onChange={(e) =>
                    setDraftIntent((p) => ({ ...p, maxDistanceMeters: Number(e.target.value) }))
                  }
                  className="w-full accent-indigo-600 mt-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                Preferred Work / Delivery Mode
              </label>
              <div className="flex flex-wrap gap-2">
                {(['Remote', 'Hybrid', 'On-Site'] as const).map((m) => {
                  const active = (draftIntent.preferredRemoteModes || []).includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleRemoteMode(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        active
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                          : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Autonomous Rules */}
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 p-3.5 space-y-2.5">
              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-zinc-900 dark:text-white">
                    Autonomous Opportunity Matching
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Continuously match open vacancies, RFPs & company/personal agents
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={draftIntent.autoMatchEnabled}
                  onChange={(e) => setDraftIntent((p) => ({ ...p, autoMatchEnabled: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 accent-indigo-600"
                />
              </label>

              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-zinc-900 dark:text-white">
                    Auto-Add Event & Public Contacts Within Radius
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Automatically save nearby Wi-Fi/BLE/compass peers to Contacts
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={draftIntent.autoAddProximityContacts}
                  onChange={(e) =>
                    setDraftIntent((p) => ({ ...p, autoAddProximityContacts: e.target.checked }))
                  }
                  className="mt-0.5 w-4 h-4 accent-emerald-600"
                />
              </label>

              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-zinc-900 dark:text-white">
                    Require Shared Intent Topic Before Auto-Add
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Filter out unrelated passersby at busy conferences
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={draftIntent.requireTopicOverlapForAutoAdd}
                  onChange={(e) =>
                    setDraftIntent((p) => ({
                      ...p,
                      requireTopicOverlapForAutoAdd: e.target.checked,
                    }))
                  }
                  className="mt-0.5 w-4 h-4 accent-indigo-600"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={handleSaveAndRunMatch}
              disabled={autonomousMatchLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {autonomousMatchLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Save Intent & Run Autonomous Match
            </button>
          </div>

          {/* Company Intent Publisher (Visible especially for Business agents, plus toggleable for any) */}
          {selectedAgent.type === 'business' && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-emerald-500" />
                    Company Intent: Publish RFPs & Vacancies
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Every RFP & Vacancy listed here enters global search & autonomous matching
                  </p>
                </div>
                <div className="inline-flex rounded-xl border border-zinc-200 dark:border-zinc-700 p-0.5 bg-zinc-50 dark:bg-zinc-950">
                  <button
                    type="button"
                    onClick={() => setCompanyFormMode('rfp')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      companyFormMode === 'rfp'
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
                        : 'text-zinc-500'
                    }`}
                  >
                    + Request for Proposal
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompanyFormMode('vacancy')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      companyFormMode === 'vacancy'
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
                        : 'text-zinc-500'
                    }`}
                  >
                    + Job Vacancy
                  </button>
                </div>
              </div>

              {companyFormMode === 'rfp' ? (
                <form onSubmit={handleCreateCompanyRfp} className="space-y-3">
                  <input
                    type="text"
                    required
                    value={rfpTitle}
                    onChange={(e) => setRfpTitle(e.target.value)}
                    placeholder="RFP Title (e.g., Cold-Chain IoT Telemetry Fleet Q1)"
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-white"
                  />
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={rfpCategory}
                      onChange={(e) => setRfpCategory(e.target.value)}
                      placeholder="Category"
                      className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-white"
                    />
                    <input
                      type="number"
                      value={rfpBudgetZAR}
                      onChange={(e) => setRfpBudgetZAR(Number(e.target.value) || 0)}
                      placeholder="Budget ZAR"
                      className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs font-mono tabular-nums text-zinc-900 dark:text-white"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={rfpDescription}
                    onChange={(e) => setRfpDescription(e.target.value)}
                    placeholder="Scope, SLA requirements & delivery timeline..."
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-white"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {(['directory', 'google_maps_billboard', 'ble_beacon', 'carplay'] as BroadcastChannel[]).map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => toggleRfpChannel(ch)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                          rfpChannels.includes(ch)
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                            : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500'
                        }`}
                      >
                        {ch.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={submittingRfp}
                    className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    {submittingRfp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                    Broadcast Company RFP
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCreateCompanyVacancy} className="space-y-3">
                  <input
                    type="text"
                    required
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Vacancy Title (e.g., Senior AI Platform Engineer)"
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-white"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={jobDept}
                      onChange={(e) => setJobDept(e.target.value)}
                      placeholder="Department"
                      className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={jobLocation}
                      onChange={(e) => setJobLocation(e.target.value)}
                      placeholder="Location"
                      className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-white"
                    />
                    <select
                      value={jobRemote}
                      onChange={(e) => setJobRemote(e.target.value as 'Remote' | 'Hybrid' | 'On-Site')}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-2.5 py-2 text-xs text-zinc-900 dark:text-white"
                    >
                      <option value="Remote">Remote</option>
                      <option value="Hybrid">Hybrid</option>
                      <option value="On-Site">On-Site</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={jobSalaryMin}
                      onChange={(e) => setJobSalaryMin(Number(e.target.value) || 0)}
                      placeholder="Min Monthly ZAR"
                      className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs font-mono tabular-nums text-zinc-900 dark:text-white"
                    />
                    <input
                      type="number"
                      value={jobSalaryMax}
                      onChange={(e) => setJobSalaryMax(Number(e.target.value) || 0)}
                      placeholder="Max Monthly ZAR"
                      className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs font-mono tabular-nums text-zinc-900 dark:text-white"
                    />
                  </div>
                  <input
                    type="text"
                    value={jobSkillsText}
                    onChange={(e) => setJobSkillsText(e.target.value)}
                    placeholder="Comma-separated skills"
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-white"
                  />
                  <textarea
                    rows={2}
                    value={jobDesc}
                    onChange={(e) => setJobDesc(e.target.value)}
                    placeholder="Role mission & requirements..."
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    List Vacancy & Auto-Match Talent
                  </button>
                </form>
              )}

              {/* Active Company RFPs & Vacancies */}
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Active on {selectedAgent.displayName} ({companyRfps.length} RFPs · {companyJobs.length} Vacancies)
                </div>
                <SwipeScrollArea direction="vertical" showArrows arrowSize="sm" className="max-h-56" innerClassName="space-y-2 pr-1">
                  {companyRfps.map((rfp) => (
                    <div
                      key={rfp.id}
                      className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">{rfp.title}</div>
                        <div className="text-[10px] text-zinc-500 font-mono tabular-nums">
                          RFP · {formatMoney(rfp.budgetZAR, currency)} · {rfp.matchedProposalsCount || 0} bids
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onUpdateRfpStatus(rfp.id, rfp.status === 'OPEN' ? 'AWARDED' : 'OPEN')}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold shrink-0 ${
                          rfp.status === 'OPEN'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {rfp.status}
                      </button>
                    </div>
                  ))}
                  {companyJobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">{job.title}</div>
                        <div className="text-[10px] text-zinc-500 font-mono tabular-nums">
                          VACANCY · {job.remoteMode} · {formatMoney(job.salaryRangeZAR[1], currency)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onUpdateJobStatus(job.id, job.status === 'OPEN' ? 'PAUSED' : 'OPEN')}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold shrink-0 ${
                          job.status === 'OPEN'
                            ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {job.status}
                      </button>
                    </div>
                  ))}
                  {companyRfps.length === 0 && companyJobs.length === 0 && (
                    <div className="text-xs text-zinc-500 py-3 text-center">
                      No RFPs or vacancies listed yet. Publish above to trigger autonomous matching.
                    </div>
                  )}
                </SwipeScrollArea>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Autonomous AI Matches Feed */}
        <div className="xl:col-span-7 space-y-4">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                    Autonomous AI Matches
                  </h2>
                  {autonomousMatchMeta?.engine && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      {autonomousMatchMeta.engine}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {autonomousMatchMeta?.executiveSummary ||
                    `Live ranked matches for ${selectedAgent.displayName} across vacancies, RFPs, peer agents & proximity contacts.`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onRunAutonomousMatch(selectedAgent)}
                disabled={autonomousMatchLoading}
                className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white inline-flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${autonomousMatchLoading ? 'animate-spin' : ''}`} />
                Refresh Matches
              </button>
            </div>

            {/* Filter Chips (SwipeScrollArea horizontal) */}
            <SwipeScrollArea direction="horizontal" showArrows arrowSize="sm" innerClassName="flex items-center gap-1.5 py-1">
              {[
                { id: 'all', label: `All (${autonomousMatches.length})` },
                {
                  id: 'job',
                  label: `Vacancies (${autonomousMatches.filter((m) => m.kind === 'job').length})`,
                },
                {
                  id: 'rfp',
                  label: `Open RFPs (${autonomousMatches.filter((m) => m.kind === 'rfp').length})`,
                },
                {
                  id: 'agent',
                  label: `Peer Agents (${autonomousMatches.filter((m) => m.kind === 'agent').length})`,
                },
                {
                  id: 'proximity_peer',
                  label: `Nearby Radar (${autonomousMatches.filter((m) => m.kind === 'proximity_peer').length})`,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMatchFilter(tab.id as typeof matchFilter)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    matchFilter === tab.id
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </SwipeScrollArea>

            {/* Match Results List */}
            {autonomousMatchLoading && autonomousMatches.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-zinc-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <span className="text-xs font-medium">Matching implied intent against vacancies, RFPs & peers...</span>
              </div>
            ) : visibleMatches.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Globe2 className="w-8 h-8 text-zinc-400 mx-auto" />
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  No matches in this category yet
                </p>
                <p className="text-xs text-zinc-500">
                  Add broader topics to your Implied Intent or switch filters above.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleMatches.map((item) => {
                  const relatedRfp = item.rfpId ? rfps.find((r) => r.id === item.rfpId) : undefined;
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/70 p-4 space-y-3 hover:border-indigo-400/50 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                                item.kind === 'job'
                                  ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                                  : item.kind === 'rfp'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : item.kind === 'proximity_peer'
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                  : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                              }`}
                            >
                              {item.kind.replace('_', ' ')}
                            </span>
                            {item.mutualFacing && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500 text-white inline-flex items-center gap-1">
                                <Compass className="w-3 h-3" /> Mutual Compass Lock
                              </span>
                            )}
                            {typeof item.distanceMeters === 'number' && (
                              <span className="text-[10px] font-mono tabular-nums px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                {item.distanceMeters}m{typeof item.bearingDeg === 'number' ? ` · ${item.bearingDeg}°` : ''}
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-zinc-900 dark:text-white leading-snug">
                            {item.title}
                          </h3>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">{item.subtitle}</div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
                          <div className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold font-mono tabular-nums">
                            {item.score}% Match
                          </div>
                          {typeof item.valueZAR === 'number' && item.valueZAR > 0 && (
                            <div className="text-xs font-bold font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                              {formatMoney(item.valueZAR, currency)}
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">{item.rationale}</p>

                      {item.matchedKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {item.matchedKeywords.map((kw) => (
                            <span
                              key={kw}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-200/70 dark:border-zinc-800/80">
                        <span className="text-[11px] font-mono text-zinc-500 inline-flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                          {item.targetHandle}
                        </span>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSaveContact(item)}
                            className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Add Contact
                          </button>

                          {item.kind === 'job' && item.jobId ? (
                            <button
                              type="button"
                              onClick={() => onApplyToJob(item.jobId!, selectedAgent)}
                              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold inline-flex items-center gap-1"
                            >
                              <Briefcase className="w-3.5 h-3.5" />
                              Apply / Tailor CV
                            </button>
                          ) : item.kind === 'rfp' && relatedRfp ? (
                            <button
                              type="button"
                              onClick={() => onPitchRfp(relatedRfp, selectedAgent)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold inline-flex items-center gap-1"
                            >
                              <Zap className="w-3.5 h-3.5" />
                              Pitch RFP
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onEngageAgent(item.targetHandle)}
                              className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 text-[11px] font-bold inline-flex items-center gap-1"
                            >
                              <Zap className="w-3.5 h-3.5" />
                              {item.recommendedAction === 'invite_candidate' ? 'Invite / Engage' : 'Engage A2A'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
