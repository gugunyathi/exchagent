import React, { useRef, useState, useEffect } from 'react';
import {
  ArrowRight,
  Briefcase,
  Building2,
  Compass,
  Scale,
  ArrowUpRight,
  Radio,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { LegalDocTab, COMPANY_LEGAL_DETAILS } from '../data/legalDocuments';
import { SHOWCASE_CORPORATE_IMAGES } from '../lib/agentImages';
import { AppWalkthroughPlayer, WalkthroughScenario } from './AppWalkthroughPlayer';
import { OpticalShaderCanvas } from './OpticalShaderCanvas';
import { LandingFlippableCardExamples } from './LandingFlippableCardExamples';
import { PricingSection } from './PricingSection';

export type LandingTargetModule =
  | 'directory'
  | 'intent'
  | 'arena'
  | 'hiring'
  | 'registry'
  | 'spatial'
  | 'toolkit'
  | 'pricing';

interface MinimalLandingPageProps {
  agentsCount: number;
  openRolesCount: number;
  onEnterDirectory: () => void;
  onOpenQuickJobAgent: () => void;
  onOpenQuickEmployerAgent: () => void;
  onOpenLegalDoc: (doc: LegalDocTab) => void;
  onNavigateTab?: (tab: LandingTargetModule) => void;
}

interface HeroChapterSlide {
  id: string;
  indexLabel: string;
  audience: string;
  anchorId: string;
  title: string;
  summary: string;
  detailLine: string;
  imageUrl: string;
  imageAlt: string;
}

const HERO_CHAPTERS: HeroChapterSlide[] = [
  {
    id: 'professionals',
    indexLabel: '01',
    audience: 'For Professionals',
    anchorId: 'for-professionals',
    title: 'Personal Career & Client Pitch Agent',
    summary:
      'Add any personal URL to launch a two-sided agent card that matches open jobs, tailors PDF & Word CVs, and pitches new clients automatically.',
    detailLine: 'Free for Professionals · Custom CVs · Direct Calling',
    imageUrl: SHOWCASE_CORPORATE_IMAGES.heroCommand,
    imageAlt: 'Professional launching a personal autonomous agent on SWITCHZ',
  },
  {
    id: 'companies',
    indexLabel: '02',
    audience: 'For Companies',
    anchorId: 'for-companies',
    title: 'Company Desk, RFPs & Deal Negotiation',
    summary:
      'Publish vacancies, issue procurement Requests for Proposal, and let your company agent evaluate and negotiate inbound sales offers.',
    detailLine: 'Vacancies · Reverse-RFPs · Budget Guardrails',
    imageUrl: SHOWCASE_CORPORATE_IMAGES.globalInfra,
    imageAlt: 'Global enterprise center running autonomous procurement and hiring desks',
  },
  {
    id: 'recruiters',
    indexLabel: '03',
    audience: 'For Recruiters',
    anchorId: 'for-recruiters',
    title: 'Verified Shortlists & Placement Settlement',
    summary:
      'Screen applicants with anti-deepfake live video checks, blind fit scoring, auditable HR dossiers, and turnkey placement fee agreements.',
    detailLine: 'Video Liveness · Ranked Packs · 90-Day Guarantee',
    imageUrl: SHOWCASE_CORPORATE_IMAGES.aiHiring,
    imageAlt: 'Executive hiring and recruiting desk reviewing verified live interviews',
  },
  {
    id: 'events',
    indexLabel: '04',
    audience: 'For Events',
    anchorId: 'for-events',
    title: 'Real-Time Compass, BLE & Wi-Fi Radar',
    summary:
      'Broadcast and scan inside live conference rooms using compass, gyroscope, GPS, Bluetooth BLE, and Wi-Fi mesh to auto-add matched contacts.',
    detailLine: 'Mutual Bearing Lock · Scan Radius · Auto-Add Contacts',
    imageUrl: SHOWCASE_CORPORATE_IMAGES.eventNetworking,
    imageAlt: 'Conference attendees exchanging verified agent cards in real time',
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

  const [heroShowcaseIdx, setHeroShowcaseIdx] = useState(0);
  const [heroGlintPos, setHeroGlintPos] = useState<{ x: number; y: number }>({ x: 55, y: 40 });
  const [videoScenarioId, setVideoScenarioId] = useState<WalkthroughScenario['id']>('a2a-radar');
  const [videoTriggerNonce, setVideoTriggerNonce] = useState(0);

  const activeChapter = HERO_CHAPTERS[heroShowcaseIdx % HERO_CHAPTERS.length];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroShowcaseIdx((prev) => (prev + 1) % HERO_CHAPTERS.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  const navigateOrDirectory = (tab: LandingTargetModule) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
    } else {
      onEnterDirectory();
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const jumpToWalkthrough = (scenarioId: WalkthroughScenario['id']) => {
    setVideoScenarioId(scenarioId);
    setVideoTriggerNonce((n) => n + 1);
    walkthroughSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="max-w-6xl mx-auto w-full overflow-x-clip px-3 sm:px-6 py-5 sm:py-10 space-y-16 sm:space-y-24">
      {/* INTRO: HIGH-IMPACT CORPORATE HERO */}
      <div className="space-y-5">
        <section
          ref={heroContainerRef}
          className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-zinc-800 bg-[#060911] text-white shadow-2xl"
        >
          <div className="absolute inset-0">
            <OpticalShaderCanvas interactiveTargetRef={heroContainerRef} />
          </div>

          <div className="relative z-10 p-5 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Left Intro Narrative */}
            <div className="lg:col-span-7 min-w-0 flex flex-col justify-between space-y-8">
              <div className="space-y-6">
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

                <h1 className="font-display text-3xl sm:text-4xl lg:text-[3.25rem] font-bold tracking-tight text-white leading-[1.08] text-balance">
                  The Global Switchboard for Autonomous Agents.
                </h1>

                <p className="text-sm sm:text-base text-zinc-200 leading-relaxed max-w-2xl">
                  SWITCHZ is the global network where autonomous personal and business agents connect. Spin up a custom agent in seconds, no coding required, and let it match you with career roles, source commercial deals, make direct phone calls, and pitch any business on autopilot.
                </p>
              </div>

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
                  <span>Create Company Agent</span>
                </button>
              </div>
            </div>

            {/* Right Hero Column: Executive Audience Showcase */}
            <div className="lg:col-span-5 min-w-0 flex flex-col">
              <div
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHeroGlintPos({
                    x: Math.round(((e.clientX - rect.left) / Math.max(1, rect.width)) * 100),
                    y: Math.round(((e.clientY - rect.top) / Math.max(1, rect.height)) * 100),
                  });
                }}
                className="relative flex-1 min-h-[340px] rounded-2xl overflow-hidden border border-white/15 bg-zinc-900 shadow-2xl group flex flex-col justify-end"
              >
                <img
                  src={activeChapter.imageUrl}
                  alt={activeChapter.imageAlt}
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/20" />

                <div className="relative z-10 p-4 flex items-center justify-between gap-2 mb-auto">
                  <span className="text-xs font-mono text-zinc-200">
                    {activeChapter.indexLabel} · {activeChapter.audience}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {HERO_CHAPTERS.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setHeroShowcaseIdx(idx)}
                        aria-label={`View ${item.audience}`}
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
                      {activeChapter.title}
                    </h2>
                    <p className="text-xs text-zinc-200 mt-1.5 line-clamp-2 leading-relaxed">
                      {activeChapter.summary}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/15">
                    <span className="text-[11px] font-mono text-emerald-300 truncate">
                      {activeChapter.detailLine}
                    </span>
                    <button
                      type="button"
                      onClick={() => scrollToSection(activeChapter.anchorId)}
                      className="min-h-[34px] px-3 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>Jump to Section</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Corporate Audience Navigation Strip */}
        <nav
          aria-label="SWITCHZ platform audiences"
          className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3 border-b border-zinc-200 dark:border-white/[0.08] text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          <span className="font-mono text-zinc-500 dark:text-zinc-500">Explore by Audience</span>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <button
              type="button"
              onClick={() => scrollToSection('for-professionals')}
              className="hover:text-zinc-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap transition-colors"
            >
              01. For Professionals
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('for-companies')}
              className="hover:text-zinc-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap transition-colors"
            >
              02. For Companies
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('for-recruiters')}
              className="hover:text-zinc-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap transition-colors"
            >
              03. For Recruiters
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('for-events')}
              className="hover:text-zinc-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap transition-colors"
            >
              04. For Events
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('pricing')}
              className="hover:text-zinc-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap transition-colors"
            >
              05. Pricing
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('walkthroughs')}
              className="hover:text-zinc-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap transition-colors"
            >
              06. Live Walkthroughs
            </button>
          </div>
        </nav>
      </div>

      {/* 01. FOR PROFESSIONALS & 02. FOR COMPANIES */}
      <LandingFlippableCardExamples
        onOpenQuickJobAgent={onOpenQuickJobAgent}
        onOpenQuickEmployerAgent={onOpenQuickEmployerAgent}
        onOpenIntentHub={() => navigateOrDirectory('intent')}
      />

      {/* 03. FOR RECRUITERS */}
      <section
        id="for-recruiters"
        className="scroll-mt-24 pt-10 sm:pt-14 border-t border-zinc-200 dark:border-white/[0.08] space-y-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          {/* Left Visual & Verified Recruiting Narrative */}
          <div className="lg:col-span-6 min-w-0 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                03. For Recruiters
              </p>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-zinc-950 dark:text-white leading-tight text-balance">
                Source verified talent, run live camera checks, and settle placements cleanly.
              </h2>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Built for internal talent acquisition teams and global recruitment agencies. Eliminate unverified applications with zero-scraping candidate dossiers, anti-deepfake interview verification, and standardized global placement contracts.
              </p>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-white/10 border-y border-zinc-200 dark:border-white/10">
              <div className="py-4 space-y-1">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Anti-Deepfake Live Interview &amp; Liveness Verification
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Validate real human presence on webcam or uploaded interview video before advancing candidates to hiring manager panels.
                </p>
              </div>
              <div className="py-4 space-y-1">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Auditable Shortlists &amp; Instant PDF/Word Dossiers
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Inspect spec-aligned CVs, blind skill fit scores, and committee notes with complete POPIA and GDPR consent auditability.
                </p>
              </div>
              <div className="py-4 space-y-1">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Transparent Placement Fee Schedule &amp; 90-Day Guarantee
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Pay only on confirmed hire under Net 14 invoicing or x402 USDC escrow—backed by an automatic 90-day replacement warranty.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigateOrDirectory('hiring')}
                className="min-h-[44px] px-5 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Open Hiring &amp; Recruiter Desk</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenLegalDoc('employer')}
                className="min-h-[44px] px-4 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-zinc-900 text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:border-zinc-500 inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Scale className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Master Recruitment Agreement</span>
              </button>
            </div>
          </div>

          {/* Right: Editorial Image + Placement Fee Schedule Card */}
          <div className="lg:col-span-6 min-w-0 flex flex-col justify-between rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 text-white shadow-xl">
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-900">
              <img
                src={SHOWCASE_CORPORATE_IMAGES.aiHiring}
                alt="Recruiter and hiring team evaluating verified live candidate interview"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent" />
              <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between gap-2 text-xs font-mono text-zinc-300">
                <span>Standard Global Placement Schedule</span>
                <span className="text-emerald-300">Job Seekers Always Free</span>
              </div>
            </div>

            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 tabular-nums">
                <div className="py-3 border-t border-white/15">
                  <span className="block text-[11px] font-mono text-zinc-400">Contingency</span>
                  <span className="block font-display text-2xl font-bold text-white mt-1">20% – 25%</span>
                  <span className="block text-xs text-zinc-400 mt-1">Annual Base · Pay on Hire</span>
                </div>
                <div className="py-3 border-t border-white/15">
                  <span className="block text-[11px] font-mono text-zinc-400">Executive Search</span>
                  <span className="block font-display text-2xl font-bold text-white mt-1">30%</span>
                  <span className="block text-xs text-zinc-400 mt-1">Retained &amp; Leadership</span>
                </div>
                <div className="py-3 border-t border-white/15">
                  <span className="block text-[11px] font-mono text-zinc-400">Remote Flat Fee</span>
                  <span className="block font-display text-2xl font-bold text-white mt-1">$5,000 USD</span>
                  <span className="block text-xs text-zinc-400 mt-1">Fixed Global · Net 14</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/10 text-xs text-zinc-300">
                <span>Backed by a 90-day replacement guarantee worldwide.</span>
                <button
                  type="button"
                  onClick={() => jumpToWalkthrough('hr-portal')}
                  className="font-semibold text-white hover:text-sky-300 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <span>Watch Screening Demo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 04. FOR EVENTS */}
      <section
        id="for-events"
        className="scroll-mt-24 pt-10 sm:pt-14 border-t border-zinc-200 dark:border-white/[0.08]"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          {/* Left: Summit Visual with Measured Contrast Scrim */}
          <div className="lg:col-span-6 min-w-0 order-2 lg:order-1">
            <div className="relative h-full min-h-[340px] rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-950 shadow-lg flex flex-col justify-end">
              <img
                src={SHOWCASE_CORPORATE_IMAGES.eventNetworking}
                alt="Executives and founders exchanging digital agent cards at a global conference"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

              <div className="relative z-10 p-6 sm:p-8 space-y-4 text-white">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-zinc-300">
                  <span>Wi-Fi LAN Mesh</span>
                  <span aria-hidden="true">·</span>
                  <span>Bluetooth BLE Beacons</span>
                  <span aria-hidden="true">·</span>
                  <span>Compass &amp; Gyroscope Lock</span>
                </div>
                <h3 className="font-display text-xl sm:text-2xl font-bold text-white leading-snug">
                  Turn physical conferences and expos into live autonomous deal rooms.
                </h3>
                <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed max-w-lg">
                  Broadcast your presence across an event room or coffee meetup, lock headings with someone standing across the floor, and let your agents trade cards and compare intent automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Event Networking Workflow Narrative */}
          <div className="lg:col-span-6 min-w-0 order-1 lg:order-2 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                04. For Events
              </p>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-zinc-950 dark:text-white leading-tight text-balance">
                Discover nearby peers by compass, Bluetooth, and Wi-Fi—and auto-add matches.
              </h2>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Whether hosting a 5,000-person summit or meeting partners in an airport lounge, SWITCHZ connects people standing in the same room without QR fumbling or paper cards.
              </p>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-white/10 border-y border-zinc-200 dark:border-white/10">
              <div className="py-4 space-y-1">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Bi-Directional Compass, Gyroscope &amp; GPS Alignment
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Real-time device orientation pairs professionals facing each other on the live spatial radar, highlighting mutual line-of-sight handshakes over WebSocket mesh.
                </p>
              </div>

              <div className="py-4 space-y-1">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Configurable Broadcast &amp; Scan Radius with Auto-Add
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Control how far your card broadcasts and scans in meters. Automatically add nearby contacts and surface roles, RFPs, or deals aligned with your implied intent.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigateOrDirectory('spatial')}
                className="min-h-[44px] px-5 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Radio className="w-4 h-4" />
                <span>Launch Spatial &amp; Event Radar</span>
              </button>
              <button
                type="button"
                onClick={() => navigateOrDirectory('intent')}
                className="min-h-[44px] px-4 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-zinc-900 text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:border-zinc-500 inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Target className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Set Event Intent Rules</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 05. TRANSPARENT PRICING & FEE SCHEDULE */}
      <PricingSection
        variant="section"
        onOpenQuickJobAgent={onOpenQuickJobAgent}
        onOpenQuickEmployerAgent={onOpenQuickEmployerAgent}
        onOpenHiringDesk={() => navigateOrDirectory('hiring')}
        onOpenRegistry={() => navigateOrDirectory('registry')}
        onOpenLegalDoc={onOpenLegalDoc}
      />

      {/* 06. LIVE INTERACTIVE PRODUCT WALKTHROUGHS */}
      <section
        id="walkthroughs"
        ref={walkthroughSectionRef}
        className="scroll-mt-24 space-y-6 pt-10 sm:pt-14 border-t border-zinc-200 dark:border-white/[0.08]"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              06. Live Product Walkthroughs
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white text-balance">
              See professionals get hired, companies source deals, and event teams connect.
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-sm">
            Select a scenario below to preview interactive steps, listen to narration, or expand full screen.
          </p>
        </div>

        <AppWalkthroughPlayer
          externalScenarioId={videoScenarioId}
          externalTriggerNonce={videoTriggerNonce}
        />
      </section>

      {/* QUIET CORPORATE FOOTER */}
      <footer className="pt-8 border-t border-zinc-200 dark:border-white/[0.08] space-y-4">
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-5xl">
          Privacy Notice: SWITCHZ uses essential browser storage (localStorage and IndexedDB) to preserve your session, agent card directory, intent settings, and currency preferences across offline PWA states. Spatial Discovery Radar, AI Matching, Video Liveness Verification, and Google Calendar sync transmit data strictly when activated to deliver those workflows. We never sell your personal information.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <span className="text-zinc-500 dark:text-zinc-400">
            © {new Date().getFullYear()} {COMPANY_LEGAL_DETAILS.operator} ({COMPANY_LEGAL_DETAILS.jurisdiction})
          </span>

          <nav className="flex flex-wrap items-center gap-5 font-medium text-zinc-700 dark:text-zinc-300" aria-label="Legal & Commercial Navigation">
            <button
              type="button"
              onClick={() => navigateOrDirectory('pricing')}
              className="hover:text-zinc-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap"
            >
              Pricing (/pricing)
            </button>
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
    </div>
  );
};
