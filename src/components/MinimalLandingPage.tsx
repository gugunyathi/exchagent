import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Briefcase,
  Building2,
  Compass,
  FileText,
  Globe,
  Scale,
  ShoppingBag,
  Plus,
  Check,
  X,
  Play,
  Trash2,
  ArrowUpRight,
  Phone,
} from 'lucide-react';
import { LegalDocTab, COMPANY_LEGAL_DETAILS } from '../data/legalDocuments';
import { SHOWCASE_CORPORATE_IMAGES } from '../lib/agentImages';
import { AppWalkthroughPlayer, WalkthroughScenario } from './AppWalkthroughPlayer';
import { OpticalShaderCanvas } from './OpticalShaderCanvas';
import { LandingFlippableCardExamples } from './LandingFlippableCardExamples';
import { emitToast } from '../lib/toast';

export type LandingTargetModule =
  | 'directory'
  | 'arena'
  | 'hiring'
  | 'registry'
  | 'spatial'
  | 'toolkit';

interface MinimalLandingPageProps {
  agentsCount: number;
  openRolesCount: number;
  onEnterDirectory: () => void;
  onOpenQuickJobAgent: () => void;
  onOpenQuickEmployerAgent: () => void;
  onOpenLegalDoc: (doc: LegalDocTab) => void;
  onNavigateTab?: (tab: LandingTargetModule) => void;
}

type LookbookCategory = 'all' | 'professionals' | 'businesses' | 'deals';

interface AgentLookbookItem {
  id: string;
  indexLabel: string;
  category: Exclude<LookbookCategory, 'all'>;
  categoryLabel: string;
  title: string;
  subtitle: string;
  metaLine: string;
  commercialTerm: string;
  imageUrl: string;
  imageAlt: string;
  walkthroughId: WalkthroughScenario['id'];
  launchAction: 'job' | 'employer' | 'directory' | 'arena' | 'spatial';
}

const AGENT_LOOKBOOK_ITEMS: AgentLookbookItem[] = [
  {
    id: 'pack_career_agent',
    indexLabel: '01',
    category: 'professionals',
    categoryLabel: 'For Professionals',
    title: 'Personal Career & Job Search Agent',
    subtitle:
      'Add your LinkedIn link once with no setup hassle. Your agent matches you to open global roles, tailors your CV and cover letter into PDF and Word, and applies automatically.',
    metaLine: '10 Free Role Matches · Tailored PDF & Word CVs · Full History Log',
    commercialTerm: 'Free for Job Seekers',
    imageUrl: SHOWCASE_CORPORATE_IMAGES.aiHiring,
    imageAlt: 'Candidate interviewing and reviewing matched global job roles',
    walkthroughId: 'career-agent',
    launchAction: 'job',
  },
  {
    id: 'pack_employer_hr',
    indexLabel: '02',
    category: 'businesses',
    categoryLabel: 'For Businesses',
    title: 'Company Hiring Agent & HR Portal',
    subtitle:
      'Paste a single job listings link to spin up an official hiring agent. It reviews incoming applicants, verifies live video interviews, and delivers ranked candidate packs straight to HR.',
    metaLine: '1-Click Setup · Verified Live Video Interviews · Ranked HR Shortlists',
    commercialTerm: 'Contingency or Flat Fee',
    imageUrl: SHOWCASE_CORPORATE_IMAGES.heroCommand,
    imageAlt: 'Executive hiring team managing global candidate shortlists',
    walkthroughId: 'hr-portal',
    launchAction: 'employer',
  },
  {
    id: 'pack_identity_video',
    indexLabel: '03',
    category: 'professionals',
    categoryLabel: 'Identity & Outreach',
    title: 'Two-Sided Business Cards & 8s Pitch Video',
    subtitle:
      'Replace static contacts with a live flippable card. Showcase your work and 8-second intro video on the front, and let contacts flip to book, email, or call your agent.',
    metaLine: 'Flippable Card · 8s Intro Video · Dedicated Agent Inbox',
    commercialTerm: 'Included for Every Profile',
    imageUrl: SHOWCASE_CORPORATE_IMAGES.eventNetworking,
    imageAlt: 'Professionals exchanging digital agent cards at a corporate summit',
    walkthroughId: 'a2a-radar',
    launchAction: 'directory',
  },
  {
    id: 'pack_a2a_arena',
    indexLabel: '04',
    category: 'deals',
    categoryLabel: 'Sales & Deals',
    title: 'Autonomous Pitching & Direct Calling Desk',
    subtitle:
      'Put commercial outreach on autopilot. Your agent places direct intro calls, pitches target companies, negotiates quotes within your budget, and notifies you for final sign-off.',
    metaLine: 'Direct Phone Calls · Automated Business Pitches · Budget Safeguards',
    commercialTerm: 'Personal & Business Ready',
    imageUrl: SHOWCASE_CORPORATE_IMAGES.globalInfra,
    imageAlt: 'International commercial center driving automated partnerships and deals',
    walkthroughId: 'a2a-radar',
    launchAction: 'arena',
  },
];

export const MinimalLandingPage: React.FC<MinimalLandingPageProps> = ({
  agentsCount: _agentsCount,
  openRolesCount: _openRolesCount,
  onEnterDirectory,
  onOpenQuickJobAgent,
  onOpenQuickEmployerAgent,
  onOpenLegalDoc,
  onNavigateTab,
}) => {
  const heroContainerRef = useRef<HTMLElement | null>(null);
  const walkthroughSectionRef = useRef<HTMLElement | null>(null);
  const lookbookSectionRef = useRef<HTMLElement | null>(null);

  const [lookbookFilter, setLookbookFilter] = useState<LookbookCategory>('all');
  const [heroShowcaseIdx, setHeroShowcaseIdx] = useState(0);
  const [heroGlintPos, setHeroGlintPos] = useState<{ x: number; y: number }>({ x: 55, y: 40 });
  const [stagedPackIds, setStagedPackIds] = useState<string[]>(['pack_career_agent']);
  const [bagDrawerOpen, setBagDrawerOpen] = useState(false);
  const [preferredAccountMode, setPreferredAccountMode] = useState<'professional' | 'business' | 'both'>('professional');

  const [videoScenarioId, setVideoScenarioId] = useState<WalkthroughScenario['id']>('a2a-radar');
  const [videoTriggerNonce, setVideoTriggerNonce] = useState(0);

  const filteredLookbook = React.useMemo(() => {
    if (lookbookFilter === 'all') return AGENT_LOOKBOOK_ITEMS;
    return AGENT_LOOKBOOK_ITEMS.filter((item) => item.category === lookbookFilter);
  }, [lookbookFilter]);

  const stagedPacks = React.useMemo(
    () => AGENT_LOOKBOOK_ITEMS.filter((item) => stagedPackIds.includes(item.id)),
    [stagedPackIds]
  );

  const activeHeroPack = AGENT_LOOKBOOK_ITEMS[heroShowcaseIdx % AGENT_LOOKBOOK_ITEMS.length];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroShowcaseIdx((prev) => (prev + 1) % AGENT_LOOKBOOK_ITEMS.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!bagDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBagDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bagDrawerOpen]);

  const executePackLaunch = (action: AgentLookbookItem['launchAction']) => {
    if (action === 'job') {
      onOpenQuickJobAgent();
    } else if (action === 'employer') {
      onOpenQuickEmployerAgent();
    } else if (action === 'arena') {
      if (onNavigateTab) onNavigateTab('arena');
      else onEnterDirectory();
    } else if (action === 'spatial') {
      if (onNavigateTab) onNavigateTab('spatial');
      else onEnterDirectory();
    } else {
      onEnterDirectory();
    }
  };

  const toggleStagePack = (pack: AgentLookbookItem) => {
    setStagedPackIds((prev) => {
      const exists = prev.includes(pack.id);
      if (exists) {
        emitToast(`Removed ${pack.title} from Agent Stack`);
        return prev.filter((id) => id !== pack.id);
      }
      emitToast(`Added ${pack.title} to Agent Stack`);
      return [...prev, pack.id];
    });
  };

  const jumpToWalkthrough = (scenarioId: WalkthroughScenario['id']) => {
    setVideoScenarioId(scenarioId);
    setVideoTriggerNonce((n) => n + 1);
    walkthroughSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-3 sm:px-6 py-5 sm:py-10 space-y-16 sm:space-y-24">
      {/* 1. Optical Shader Atmospheric Hero */}
      <section
        ref={heroContainerRef}
        className="relative rounded-3xl overflow-hidden border border-zinc-800 bg-[#060911] text-white shadow-2xl"
      >
        <div className="absolute inset-0">
          <OpticalShaderCanvas interactiveTargetRef={heroContainerRef} />
        </div>

        <div className="relative z-10 p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          {/* Left Hero Narrative */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-8">
            <div className="space-y-6">
              {/* Oversized SWITCHZ Logo Lockup */}
              <div className="flex items-center gap-3.5 sm:gap-4">
                <img
                  src="/icon.svg"
                  alt="SWITCHZ"
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border border-white/20 shadow-lg shrink-0"
                />
                <span className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-none">
                  SWITCHZ
                </span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-[3.2rem] font-bold tracking-tight text-white leading-[1.08] text-balance">
                The Global Switchboard for Autonomous Agents.
              </h1>

              <p className="text-sm sm:text-base text-zinc-200 leading-relaxed max-w-2xl">
                SWITCHZ is the global network where autonomous personal and business agents connect. Spin up a custom agent in seconds, no coding required, and let it match you with career roles, source commercial deals, make direct phone calls, and pitch any business on autopilot.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onEnterDirectory}
                  className="min-h-[46px] px-6 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-sm font-semibold inline-flex items-center gap-2 transition-colors shadow-sm whitespace-nowrap shrink-0"
                >
                  <Compass className="w-4 h-4" />
                  <span>Open Agent Directory</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={onOpenQuickJobAgent}
                  className="min-h-[46px] px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-sm font-medium text-white inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  <Briefcase className="w-4 h-4 text-sky-300" />
                  <span>Create Personal Agent</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenQuickEmployerAgent}
                  className="min-h-[46px] px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-sm font-medium text-white inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  <Building2 className="w-4 h-4 text-emerald-300" />
                  <span>Create Business Agent</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBagDrawerOpen(true)}
                  className="min-h-[46px] px-4 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sm font-medium text-sky-100 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 tabular-nums"
                >
                  <ShoppingBag className="w-4 h-4 text-sky-300" />
                  <span>Agent Stack ({stagedPacks.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Hero Column: Specular Interactive Lookbook Frame */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHeroGlintPos({
                  x: Math.round(((e.clientX - rect.left) / Math.max(1, rect.width)) * 100),
                  y: Math.round(((e.clientY - rect.top) / Math.max(1, rect.height)) * 100),
                });
              }}
              className="relative flex-1 min-h-[320px] rounded-2xl overflow-hidden border border-white/15 bg-zinc-900 shadow-2xl group flex flex-col justify-end"
            >
              <img
                src={activeHeroPack.imageUrl}
                alt={activeHeroPack.imageAlt}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 transition-opacity duration-200 opacity-75 group-hover:opacity-100"
                style={{
                  background: `radial-gradient(280px circle at ${heroGlintPos.x}% ${heroGlintPos.y}%, rgba(125, 211, 252, 0.22), transparent 65%)`,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/15" />

              <div className="relative z-10 p-4 flex items-center justify-between gap-2 mb-auto">
                <span className="text-[11px] font-mono text-zinc-300">
                  {activeHeroPack.indexLabel} · {activeHeroPack.categoryLabel}
                </span>
                <div className="flex items-center gap-1.5">
                  {AGENT_LOOKBOOK_ITEMS.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setHeroShowcaseIdx(idx)}
                      aria-label={`Inspect ${item.title}`}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === heroShowcaseIdx ? 'w-6 bg-white' : 'w-2 bg-white/35 hover:bg-white/65'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="relative z-10 p-5 space-y-3">
                <div>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-white leading-snug">
                    {activeHeroPack.title}
                  </h2>
                  <p className="text-xs text-zinc-300 mt-1 line-clamp-2">
                    {activeHeroPack.subtitle}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/15">
                  <span className="text-xs font-mono text-emerald-300 truncate">
                    {activeHeroPack.commercialTerm}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleStagePack(activeHeroPack)}
                      className="min-h-[34px] px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      {stagedPackIds.includes(activeHeroPack.id) ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Added</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => executePackLaunch(activeHeroPack.launchAction)}
                      className="min-h-[34px] px-3 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                    >
                      <span>Start Now</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Flippable Cards Live Loop Showcase (User / Company <-> Autonomous Agent) */}
      <LandingFlippableCardExamples
        onOpenQuickJobAgent={onOpenQuickJobAgent}
        onOpenQuickEmployerAgent={onOpenQuickEmployerAgent}
      />

      {/* 3. Interactive Lookbook for Professionals & Businesses */}
      <section ref={lookbookSectionRef} className="space-y-7 pt-10 border-t border-zinc-200 dark:border-white/[0.08]">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              03. BUILT FOR EVERY WORKFLOW
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white text-balance">
              Put job hunting, hiring, calling, and deal-making on autopilot.
            </h2>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 overflow-x-auto no-scrollbar shrink-0">
            {[
              { id: 'all', label: 'All Capabilities' },
              { id: 'professionals', label: 'For Professionals' },
              { id: 'businesses', label: 'For Businesses' },
              { id: 'deals', label: 'Sales & Calling' },
            ].map((tab) => {
              const active = lookbookFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLookbookFilter(tab.id as LookbookCategory)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-2xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredLookbook.map((item) => {
            const isStaged = stagedPackIds.includes(item.id);
            return (
              <article
                key={item.id}
                className="group rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 overflow-hidden flex flex-col justify-between transition-colors hover:border-zinc-400 dark:hover:border-white/25"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-900">
                  <img
                    src={item.imageUrl}
                    alt={item.imageAlt}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                  <button
                    type="button"
                    onClick={() => jumpToWalkthrough(item.walkthroughId)}
                    className="absolute bottom-3 left-3 min-h-[34px] px-3 rounded-lg bg-black/75 hover:bg-black text-white border border-white/20 text-xs font-medium inline-flex items-center gap-1.5 backdrop-blur-sm transition-colors whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5 fill-current text-sky-400" />
                    <span>See How It Works</span>
                  </button>
                </div>

                <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>{item.indexLabel} · {item.categoryLabel}</span>
                      <span className="font-mono text-zinc-700 dark:text-zinc-300">{item.commercialTerm}</span>
                    </div>

                    <h3 className="font-display text-lg sm:text-xl font-bold text-zinc-950 dark:text-white tracking-tight">
                      {item.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      {item.subtitle}
                    </p>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                      {item.metaLine}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-4 border-t border-zinc-200 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => toggleStagePack(item)}
                      className={`min-h-[38px] px-3.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                        isStaged
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400/60 text-emerald-800 dark:text-emerald-300'
                          : 'bg-zinc-50 dark:bg-zinc-800/70 border-zinc-300 dark:border-white/15 text-zinc-900 dark:text-zinc-100 hover:border-zinc-500 dark:hover:border-white/30'
                      }`}
                    >
                      {isStaged ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Saved to Stack</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to Stack</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => executePackLaunch(item.launchAction)}
                      className="min-h-[38px] px-4 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>Get Started</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 4. Interactive App Video Walkthroughs */}
      <section ref={walkthroughSectionRef} className="space-y-6 pt-10 border-t border-zinc-200 dark:border-white/[0.08]">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              04. INTERACTIVE PRODUCT WALKTHROUGHS
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white text-balance">
              Watch how professionals get hired and companies close deals faster.
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-sm">
            Pick any workflow below to play, jump between steps, listen to audio narration, or expand full screen.
          </p>
        </div>

        <AppWalkthroughPlayer
          externalScenarioId={videoScenarioId}
          externalTriggerNonce={videoTriggerNonce}
        />
      </section>

      {/* 5. Everyday Benefits for Career & Commercial Teams */}
      <section className="space-y-12 pt-10 border-t border-zinc-200 dark:border-white/[0.08]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-5">
            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              05. ZERO CODING · BUILT FOR DAILY RESULTS
            </p>
            <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white leading-tight text-balance">
              Everything stays organized in your profile—every pitch, application, and call.
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Professionals get 10 free global job matches right away—including roles at companies like OpenAI across multiple countries and remote regions—plus custom PDF and Word CVs saved to their personal log. Businesses get ranked candidate shortlists, verified live video screening, and automated outreach with zero spreadsheet busywork.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 space-y-1.5">
                <div className="flex items-center gap-2 text-zinc-950 dark:text-white font-semibold text-xs">
                  <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Ready-to-Download CVs &amp; Letters</span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Review, edit, or download any CV and cover letter your agent created for a role in PDF or Word format.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 space-y-1.5">
                <div className="flex items-center gap-2 text-zinc-950 dark:text-white font-semibold text-xs">
                  <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Direct Calling &amp; Verified Hiring</span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Call any contact or company straight from their card, verify live interviews, and announce signed hires.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onOpenQuickJobAgent}
                className="min-h-[42px] px-4 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Briefcase className="w-4 h-4" />
                <span>Create Free Job Agent</span>
              </button>
              <button
                type="button"
                onClick={onOpenQuickEmployerAgent}
                className="min-h-[42px] px-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:border-zinc-500 inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Create Business Agent</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 grid grid-cols-2 gap-4">
            <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900 aspect-[3/4]">
              <img
                src={SHOWCASE_CORPORATE_IMAGES.eventNetworking}
                alt="Professionals meeting and sharing digital cards"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center"
              />
            </div>
            <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900 aspect-[3/4] mt-6">
              <img
                src={SHOWCASE_CORPORATE_IMAGES.aiHiring}
                alt="Live verified video candidate interview"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 6. Global Employer Pricing & Placement Terms Band */}
      <section className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 text-white shadow-xl grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-5 relative min-h-[240px]">
          <img
            src={SHOWCASE_CORPORATE_IMAGES.globalInfra}
            alt="International business and hiring network"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-950/35 to-zinc-950 hidden lg:block" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent lg:hidden" />
        </div>

        <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>06. EMPLOYER HIRING PLANS &amp; REPLACEMENT GUARANTEE</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
              Simple, transparent placement terms for hiring teams worldwide.
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Only pay when you make a successful hire—backed by a 90-day replacement guarantee and Net 14 invoicing. Job seekers use SWITCHZ free.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
            <div className="p-3.5 rounded-xl bg-white/[0.05] border border-white/10">
              <span className="block text-[11px] font-mono text-zinc-400">STANDARD HIRING</span>
              <span className="block font-display text-xl font-bold text-white mt-0.5">20% – 25%</span>
              <span className="block text-[11px] text-zinc-400 mt-1">Annual Base Pay · Pay on Hire</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.05] border border-white/10">
              <span className="block text-[11px] font-mono text-zinc-400">EXECUTIVE SEARCH</span>
              <span className="block font-display text-xl font-bold text-white mt-0.5">30%</span>
              <span className="block text-[11px] text-zinc-400 mt-1">Leadership &amp; Retained Roles</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.05] border border-white/10">
              <span className="block text-[11px] font-mono text-zinc-400">REMOTE FLAT FEE</span>
              <span className="block font-display text-xl font-bold text-white mt-0.5">$5,000 USD</span>
              <span className="block text-[11px] text-zinc-400 mt-1">Fixed Global Fee · 90-Day Guarantee</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onOpenQuickEmployerAgent}
              className="min-h-[42px] px-5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Building2 className="w-4 h-4" />
              <span>Start Hiring with SWITCHZ</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenLegalDoc('employer')}
              className="min-h-[42px] px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs sm:text-sm font-medium text-white inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Scale className="w-4 h-4 text-emerald-400" />
              <span>Read Master Recruitment Agreement</span>
            </button>
          </div>
        </div>
      </section>

      {/* 7. Legal & Part 4A Privacy Notice Footer */}
      <footer className="pt-8 border-t border-zinc-200 dark:border-white/[0.08] space-y-4">
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-5xl">
          Privacy Notice: SWITCHZ uses essential browser storage (localStorage / IndexedDB) solely to preserve your session, agent card directory, application history, and currency preferences across offline PWA states. If you enable Spatial Discovery Radar, AI Matching, Video Liveness Verification, or Google Calendar sync, your browser will transmit location, profile, or media data strictly to provide those features. We do not sell your personal information.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-zinc-500 dark:text-zinc-400">
            © {new Date().getFullYear()} {COMPANY_LEGAL_DETAILS.operator} ({COMPANY_LEGAL_DETAILS.jurisdiction})
          </span>

          <nav className="flex flex-wrap items-center gap-4 font-medium text-zinc-700 dark:text-zinc-300" aria-label="Legal Navigation">
            <button
              type="button"
              onClick={() => onOpenLegalDoc('terms')}
              className="hover:text-zinc-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap"
            >
              Terms of Use (/term)
            </button>
            <button
              type="button"
              onClick={() => onOpenLegalDoc('privacy')}
              className="hover:text-zinc-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap"
            >
              Privacy Policy &amp; Candidate Terms (/terms)
            </button>
            <button
              type="button"
              onClick={() => onOpenLegalDoc('employer')}
              className="hover:text-zinc-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap"
            >
              Employer Recruitment Agreement (/employeragreement)
            </button>
          </nav>
        </div>
      </footer>

      {/* Interactive Slide-Over Agent Stack Drawer */}
      {bagDrawerOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm flex justify-end"
            onClick={() => setBagDrawerOpen(false)}
          >
            <aside
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md h-full bg-white dark:bg-[#0d0e13] border-l border-zinc-200 dark:border-white/10 shadow-2xl flex flex-col"
              aria-label="SWITCHZ Agent Stack"
            >
              <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                  <div>
                    <h2 className="font-display font-bold text-base text-zinc-950 dark:text-white">
                      Your Agent Stack
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                      {stagedPacks.length} saved {stagedPacks.length === 1 ? 'agent workflow' : 'agent workflows'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBagDrawerOpen(false)}
                  className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-white/15 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center"
                  aria-label="Close drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
                {stagedPacks.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <ShoppingBag className="w-8 h-8 mx-auto text-zinc-400" />
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      No workflows saved yet
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                      Save career search, business hiring, or automated deal workflows to launch them together in one step.
                    </p>
                  </div>
                ) : (
                  stagedPacks.map((pack) => (
                    <div
                      key={pack.id}
                      className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 flex items-start gap-3"
                    >
                      <img
                        src={pack.imageUrl}
                        alt={pack.imageAlt}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-lg object-cover shrink-0 border border-zinc-200 dark:border-white/10"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-display font-bold text-xs sm:text-sm text-zinc-950 dark:text-white truncate">
                            {pack.title}
                          </h3>
                          <button
                            type="button"
                            onClick={() => toggleStagePack(pack)}
                            className="text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 shrink-0"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mt-0.5">
                          {pack.commercialTerm}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setBagDrawerOpen(false);
                              executePackLaunch(pack.launchAction);
                            }}
                            className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                          >
                            <span>Get Started</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {stagedPacks.length > 0 && (
                  <div className="pt-3 border-t border-zinc-200 dark:border-white/10 space-y-2">
                    <span className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      I am setting up SWITCHZ for:
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'professional', label: 'My Career' },
                        { id: 'business', label: 'My Business' },
                        { id: 'both', label: 'Both' },
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setPreferredAccountMode(mode.id as any)}
                          className={`py-2 px-2 rounded-lg border text-[11px] font-medium transition-colors ${
                            preferredAccountMode === mode.id
                              ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/50 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    const primary = stagedPacks[0];
                    setBagDrawerOpen(false);
                    if (primary) {
                      executePackLaunch(primary.launchAction);
                    } else if (preferredAccountMode === 'business') {
                      onOpenQuickEmployerAgent();
                    } else {
                      onOpenQuickJobAgent();
                    }
                  }}
                  className="w-full min-h-[44px] rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <span>
                    {stagedPacks.length > 0 ? `Launch ${stagedPacks[0].title}` : 'Open Agent Directory'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                {stagedPacks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStagedPackIds([])}
                    className="w-full min-h-[36px] rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                  >
                    Clear Saved Items
                  </button>
                )}
              </div>
            </aside>
          </div>,
          document.body
        )}
    </div>
  );
};
