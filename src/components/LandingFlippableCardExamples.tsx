import React, { useEffect, useState } from 'react';
import {
  RotateCw,
  Phone,
  Mail,
  Briefcase,
  Building2,
  User,
  Bot,
  Play,
  Pause,
  Zap,
  CheckCircle2,
  Globe,
  FileText,
  Handshake,
} from 'lucide-react';
import { resolveAgentImage } from '../lib/agentImages';

interface FlippablePreviewSpec {
  id: 'user' | 'company';
  kindLabel: string;
  name: string;
  handle: string;
  headline: string;
  summary: string;
  imageUrl: string;
  phone: string;
  email: string;
  accentHex: string;
  humanTags: string;
  agentTitle: string;
  agentSubtitle: string;
  agentCapabilities: Array<{ label: string; detail: string }>;
}

const PERSONAL_CARD_SPEC: FlippablePreviewSpec = {
  id: 'user',
  kindLabel: 'Personal Professional',
  name: 'Chris Moleme',
  handle: 'chris.moleme.agent',
  headline: 'Growth & B2B Partnerships Lead',
  summary:
    'Matches with open roles globally, pitches prospective clients directly, and answers intro calls around the clock.',
  imageUrl: resolveAgentImage({ id: 'agent_chris_moleme', type: 'persona' }),
  phone: '+27 83 338 4670',
  email: 'chris@moleme.agent',
  accentHex: '#0284c7',
  humanTags: '8s Video Intro · Portfolio · Direct Contact',
  agentTitle: 'Personal Career & Client Pitch Agent',
  agentSubtitle: 'Works 24/7 finding roles, customizing CVs, and pitching new customers.',
  agentCapabilities: [
    { label: 'Job Discovery & Tailoring', detail: 'Finds matching vacancies & prepares custom PDF/Word CVs' },
    { label: 'Pitch for Customers', detail: 'Reaches out to prospective clients & sends tailored proposals' },
    { label: 'Direct Phone & Inbox', detail: 'Places qualifying calls & books meetings directly on calendar' },
  ],
};

const BUSINESS_CARD_SPEC: FlippablePreviewSpec = {
  id: 'company',
  kindLabel: 'Company & Enterprise',
  name: 'OpenAI Global Hiring',
  handle: 'careers.openai.agent',
  headline: 'Global Talent, Procurement & Partner Desk',
  summary:
    'Matches skilled professionals to open roles, publishes supplier RFPs, and reviews incoming sales & partnership offers.',
  imageUrl: resolveAgentImage({ id: 'agent_openai_careers', type: 'business' }),
  phone: '+1 415 800 9400',
  email: 'hiring@careers.openai.agent',
  accentHex: '#09090b',
  humanTags: 'Open Vacancies · Active RFPs · Inbound Proposals',
  agentTitle: 'Autonomous Business Agent',
  agentSubtitle: 'Handles talent matching, RFP broadcasting, and vendor proposal approvals.',
  agentCapabilities: [
    { label: 'Match Skilled Talent', detail: 'Ranks qualified candidates against vacancies & briefs HR' },
    { label: 'Request for Proposals', detail: 'Issues procurement RFPs and compares qualified bids' },
    { label: 'Accept Business Proposals', detail: 'Evaluates inbound sales pitches inside approved budgets' },
  ],
};

const InteractiveFlipCard: React.FC<{
  spec: FlippablePreviewSpec;
  isFlipped: boolean;
  onToggleFlip: () => void;
  onPrimaryAction: () => void;
}> = ({ spec, isFlipped, onToggleFlip, onPrimaryAction }) => {
  return (
    <div
      className="relative w-full min-h-[410px] cursor-pointer"
      style={{ perspective: '1200px' }}
      onClick={onToggleFlip}
    >
      <div
        className="relative w-full h-full min-h-[410px] transition-transform duration-700"
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* FRONT FACE: USER OR COMPANY PROFILE */}
        <div
          className="absolute inset-0 rounded-2xl border border-zinc-200 dark:border-white/15 bg-white dark:bg-[#13141a] shadow-lg overflow-hidden flex flex-col"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div
            className="px-4 py-3 text-white flex items-center justify-between gap-2"
            style={{ backgroundColor: spec.accentHex }}
          >
            <div className="flex items-center gap-1.5 text-xs font-medium">
              {spec.id === 'user' ? <User className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
              <span>Front · {spec.kindLabel}</span>
            </div>
            <span className="text-[11px] font-mono opacity-85">Click to flip</span>
          </div>

          <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
            <div className="flex items-start gap-3.5">
              <img
                src={spec.imageUrl}
                alt={spec.name}
                referrerPolicy="no-referrer"
                className={`w-20 h-24 rounded-xl object-cover shrink-0 border border-zinc-200 dark:border-white/10 ${
                  spec.id === 'user' ? 'object-top' : 'object-center'
                }`}
              />
              <div className="min-w-0 space-y-1">
                <h3 className="font-display font-bold text-base text-zinc-950 dark:text-white leading-tight truncate">
                  {spec.name}
                </h3>
                <p className="text-xs font-mono text-sky-600 dark:text-sky-400 truncate">
                  {spec.handle}
                </p>
                <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 line-clamp-2">
                  {spec.headline}
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {spec.summary}
            </p>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {spec.humanTags}
            </p>

            <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-white/10 text-xs text-zinc-700 dark:text-zinc-300">
              <div className="flex items-center gap-2 truncate">
                <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="font-mono">{spec.phone}</span>
              </div>
              <div className="flex items-center gap-2 truncate">
                <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="font-mono truncate">{spec.email}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFlip();
                }}
                className="flex-1 min-h-[38px] rounded-xl border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Flip to Agent</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPrimaryAction();
                }}
                className="flex-1 min-h-[38px] rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{spec.id === 'user' ? 'Create Yours' : 'Add Business'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* BACK FACE: AUTONOMOUS PERSONAL OR BUSINESS AGENT */}
        <div
          className="absolute inset-0 rounded-2xl border border-zinc-800 bg-[#0b0e17] text-white shadow-xl overflow-hidden flex flex-col"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="px-4 py-3 bg-white/[0.06] border-b border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-300">
              <Bot className="w-3.5 h-3.5" />
              <span>Back · Autonomous Agent</span>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">{spec.handle}</span>
          </div>

          <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
            <div>
              <h3 className="font-display font-bold text-base text-white">
                {spec.agentTitle}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                {spec.agentSubtitle}
              </p>
            </div>

            <div className="space-y-2.5">
              {spec.agentCapabilities.map((cap) => (
                <div
                  key={cap.label}
                  className="p-2.5 rounded-xl bg-white/[0.05] border border-white/10 flex items-start gap-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="block text-xs font-semibold text-white">
                      {cap.label}
                    </span>
                    <span className="block text-[11px] text-zinc-300 leading-snug">
                      {cap.detail}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-white/10">
              <span className="inline-flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span>Active Worldwide 24/7</span>
              </span>
              <span>Final Approval Always Yours</span>
            </div>

            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFlip();
                }}
                className="flex-1 min-h-[38px] rounded-xl border border-white/20 text-xs font-medium text-zinc-200 hover:bg-white/10 inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Flip to Profile</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPrimaryAction();
                }}
                className="flex-1 min-h-[38px] rounded-xl bg-emerald-500 text-zinc-950 hover:bg-emerald-400 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                {spec.id === 'user' ? (
                  <Briefcase className="w-3.5 h-3.5" />
                ) : (
                  <Building2 className="w-3.5 h-3.5" />
                )}
                <span>{spec.id === 'user' ? 'Spin Up Free' : 'Create Company'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface LandingFlippableCardExamplesProps {
  onOpenQuickJobAgent: () => void;
  onOpenQuickEmployerAgent: () => void;
}

export const LandingFlippableCardExamples: React.FC<LandingFlippableCardExamplesProps> = ({
  onOpenQuickJobAgent,
  onOpenQuickEmployerAgent,
}) => {
  const [autoFlip, setAutoFlip] = useState(true);
  const [flippedMap, setFlippedMap] = useState<{ user: boolean; company: boolean }>({
    user: false,
    company: true,
  });

  useEffect(() => {
    if (!autoFlip) return;
    const timer = window.setInterval(() => {
      setFlippedMap((prev) => ({
        user: !prev.user,
        company: !prev.company,
      }));
    }, 3800);
    return () => window.clearInterval(timer);
  }, [autoFlip]);

  const toggleSingleCard = (id: 'user' | 'company') => {
    setAutoFlip(false);
    setFlippedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-16 sm:space-y-24">
      {/* SECTION 01: FOR PROFESSIONALS */}
      <section className="space-y-8 pt-10 border-t border-zinc-200 dark:border-white/[0.08]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Narrative for Professionals */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                01. FOR PROFESSIONALS
              </p>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-zinc-950 dark:text-white leading-tight text-balance">
                Create a personal agent that finds you jobs and pitches new customers.
              </h2>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Whether you are looking for your next role or winning freelance and consulting clients, your two-sided personal card puts your work and an active autonomous agent in front of decision-makers worldwide.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 flex items-start gap-3">
                <Briefcase className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                    Find Jobs &amp; Tailor CVs Automatically
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                    Add your LinkedIn link once and get 10 free job matches immediately—including remote and international vacancies—with custom PDF and Word CVs and cover letters submitted for you.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 flex items-start gap-3">
                <Handshake className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                    Pitch Customers &amp; Win Commercial Work
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                    Let your personal agent introduce your services to businesses, send 8-second video pitch cards, follow up by email, and book discovery calls straight onto your calendar.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onOpenQuickJobAgent}
                className="min-h-[42px] px-5 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <User className="w-4 h-4" />
                <span>Create Personal Flip Agent</span>
              </button>
              <button
                type="button"
                onClick={() => setAutoFlip((v) => !v)}
                className="min-h-[42px] px-4 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-zinc-100 hover:border-zinc-500 inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                {autoFlip ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{autoFlip ? 'Pause Card Loop' : 'Play Card Loop'}</span>
              </button>
            </div>
          </div>

          {/* Right: Looping Interactive Personal Flip Card */}
          <div className="lg:col-span-6 space-y-3">
            <div className="max-w-md mx-auto lg:ml-auto lg:mr-0">
              <InteractiveFlipCard
                spec={PERSONAL_CARD_SPEC}
                isFlipped={flippedMap.user}
                onToggleFlip={() => toggleSingleCard('user')}
                onPrimaryAction={onOpenQuickJobAgent}
              />
              <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 mt-2.5">
                Auto-flipping example: Personal Profile on front · Job &amp; Client Agent on back (click card to flip)
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 02: FOR BUSINESSES */}
      <section className="space-y-8 pt-10 border-t border-zinc-200 dark:border-white/[0.08]">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              02. FOR BUSINESSES
            </p>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-zinc-950 dark:text-white leading-tight text-balance">
              Match skilled talent to vacancies, request proposals, and accept sales deals on autopilot.
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Give your company an always-on agent card that connects directly with candidates, suppliers, and partners—screening applicants for HR, broadcasting procurement needs, and closing approved commercial offers.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenQuickEmployerAgent}
            className="min-h-[42px] px-5 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors self-start md:self-auto whitespace-nowrap shrink-0"
          >
            <Building2 className="w-4 h-4" />
            <span>Create Business Agent</span>
          </button>
        </div>

        {/* Business Capabilities Cards + Looping Real Video & Company Flip Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left 4 cols: 3 Core Business Capabilities */}
          <div className="lg:col-span-4 flex flex-col justify-between gap-3">
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 space-y-1.5 flex-1">
              <div className="flex items-center gap-2 text-zinc-950 dark:text-white font-semibold text-sm">
                <Briefcase className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>Match Skilled Professionals to Vacancies</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Paste your jobs page link to spin up a hiring agent that evaluates applicants, verifies live video interviews, and delivers ranked candidate packs to HR.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 space-y-1.5 flex-1">
              <div className="flex items-center gap-2 text-zinc-950 dark:text-white font-semibold text-sm">
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Request for Proposals (RFPs)</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Publish vendor, software, or contractor requirements so qualified providers automatically pitch structured quotes directly to your business agent.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 space-y-1.5 flex-1">
              <div className="flex items-center gap-2 text-zinc-950 dark:text-white font-semibold text-sm">
                <Handshake className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Accept Sales &amp; Business Proposals</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Review inbound commercial offers negotiated inside your budget boundaries, negotiate terms via your agent, and sign off on approved deals in one click.
              </p>
            </div>
          </div>

          {/* Middle 4 cols: Real Looping Card Flip Video Recording */}
          <div className="lg:col-span-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-950 text-white overflow-hidden flex flex-col justify-between shadow-lg">
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-2">
              <div>
                <span className="block text-[11px] font-mono text-sky-400">COMPANY CARD LOOP · VIDEO</span>
                <h3 className="font-display font-bold text-sm text-white mt-0.5">
                  Company ⇄ Agent in Action
                </h3>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">Looping</span>
            </div>

            <div className="relative flex-1 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center p-3">
              <video
                src="/assets/aistudio/flip_card_25d37115.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full max-w-[300px] rounded-xl shadow-md border border-zinc-200 dark:border-white/10 object-contain"
                aria-label="Looping video demonstrating flipping between a company business card and its autonomous business agent view"
              />
            </div>

            <div className="p-3.5 border-t border-white/10 bg-zinc-900/70">
              <p className="text-xs text-zinc-300 leading-snug">
                Front displays your brand, open roles &amp; phone line. Flip to engage your company agent for bids, partnerships &amp; hiring.
              </p>
            </div>
          </div>

          {/* Right 4 cols: Interactive Auto-Flipping Company Card */}
          <div className="lg:col-span-4 flex flex-col">
            <InteractiveFlipCard
              spec={BUSINESS_CARD_SPEC}
              isFlipped={flippedMap.company}
              onToggleFlip={() => toggleSingleCard('company')}
              onPrimaryAction={onOpenQuickEmployerAgent}
            />
          </div>
        </div>
      </section>
    </div>
  );
};
