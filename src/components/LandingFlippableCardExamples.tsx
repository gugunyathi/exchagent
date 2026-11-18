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
  Target,
  ArrowRight,
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
  agentTitle: 'Personal Career & Client Agent',
  agentSubtitle: 'Finds matching roles, customizes CVs, and pitches new customers 24/7.',
  agentCapabilities: [
    { label: 'URL-to-Agent Matching', detail: 'Reads your personal link and auto-matches advertised jobs' },
    { label: 'Client & Deal Outreach', detail: 'Sends tailored commercial proposals to prospective companies' },
    { label: 'Direct Phone & Calendar', detail: 'Answers intro calls and schedules confirmed meetings' },
  ],
};

const COMPANY_CARD_SPEC: FlippablePreviewSpec = {
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
  agentTitle: 'Autonomous Company Agent',
  agentSubtitle: 'Coordinates talent matching, RFP sourcing, and commercial deal approval.',
  agentCapabilities: [
    { label: 'Match Skilled Talent', detail: 'Ranks qualified candidates against vacancies and briefs HR' },
    { label: 'Request for Proposals', detail: 'Publishes procurement RFPs and compares qualified quotes' },
    { label: 'Accept Business Offers', detail: 'Negotiates inbound sales pitches inside approved budgets' },
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
      className="relative w-full min-h-[450px] sm:min-h-[420px] cursor-pointer"
      style={{ perspective: '1200px' }}
      onClick={onToggleFlip}
    >
      <div
        className="relative w-full h-full min-h-[450px] sm:min-h-[420px] transition-transform duration-700"
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* FRONT FACE: HUMAN OR COMPANY PROFILE */}
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
                <p className="text-xs font-mono text-sky-700 dark:text-sky-400 truncate">
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

            <div className="space-y-1.5 pt-2.5 border-t border-zinc-200 dark:border-white/10 text-xs text-zinc-700 dark:text-zinc-300">
              <div className="flex items-center gap-2 truncate">
                <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="font-mono tabular-nums">{spec.phone}</span>
              </div>
              <div className="flex items-center gap-2 truncate">
                <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="font-mono truncate">{spec.email}</span>
              </div>
            </div>

            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFlip();
                }}
                className="flex-1 min-h-[40px] rounded-xl border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
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
                className="flex-1 min-h-[40px] rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{spec.id === 'user' ? 'Create Yours' : 'Add Company'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* BACK FACE: AUTONOMOUS AGENT */}
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
            <span className="text-[11px] font-mono text-zinc-400 truncate">{spec.handle}</span>
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

            <div className="divide-y divide-white/10 border-y border-white/10">
              {spec.agentCapabilities.map((cap) => (
                <div key={cap.label} className="py-2.5 flex items-start gap-2.5">
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

            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span>Active Worldwide 24/7</span>
              </span>
              <span>Human Final Approval</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFlip();
                }}
                className="flex-1 min-h-[40px] rounded-xl border border-white/20 text-xs font-medium text-zinc-200 hover:bg-white/10 inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
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
                className="flex-1 min-h-[40px] rounded-xl bg-emerald-500 text-zinc-950 hover:bg-emerald-400 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
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
  onOpenIntentHub?: () => void;
}

export const LandingFlippableCardExamples: React.FC<LandingFlippableCardExamplesProps> = ({
  onOpenQuickJobAgent,
  onOpenQuickEmployerAgent,
  onOpenIntentHub,
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
    }, 4200);
    return () => window.clearInterval(timer);
  }, [autoFlip]);

  const toggleSingleCard = (id: 'user' | 'company') => {
    setAutoFlip(false);
    setFlippedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-16 sm:space-y-24">
      {/* 01. FOR PROFESSIONALS */}
      <section
        id="for-professionals"
        className="scroll-mt-24 pt-10 sm:pt-14 border-t border-zinc-200 dark:border-white/[0.08]"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-6 min-w-0 space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                01. For Professionals
              </p>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-zinc-950 dark:text-white leading-tight text-balance">
                Turn any personal link into a 24/7 career and client-pitching agent.
              </h2>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Paste your LinkedIn, portfolio, or personal URL to create a verified two-sided agent card. Declare your intent once and let your agent find jobs, tailor CVs, and pitch commercial clients worldwide.
              </p>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-white/10 border-y border-zinc-200 dark:border-white/10">
              <div className="py-4 space-y-1">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Instant URL-to-Agent Profile &amp; Job Matching
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Your agent auto-matches advertised employer roles—including remote and international vacancies—and produces tailored PDF and Word CVs plus cover letters logged in your history.
                </p>
              </div>

              <div className="py-4 space-y-1">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Implied Intent &amp; Automated Client Outreach
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Set your career or consulting goals on your Intent page, attach an 8-second intro video, and let prospective clients call, email, or engage your agent directly.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onOpenQuickJobAgent}
                className="min-h-[44px] px-5 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <User className="w-4 h-4" />
                <span>Create Personal Agent</span>
              </button>
              {onOpenIntentHub && (
                <button
                  type="button"
                  onClick={onOpenIntentHub}
                  className="min-h-[44px] px-4 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-zinc-900 text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:border-zinc-500 inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                  <Target className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Set My Intent</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setAutoFlip((v) => !v)}
                className="min-h-[44px] px-3.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                {autoFlip ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{autoFlip ? 'Pause Loop' : 'Play Loop'}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 min-w-0">
            <div className="max-w-md mx-auto lg:ml-auto lg:mr-0">
              <InteractiveFlipCard
                spec={PERSONAL_CARD_SPEC}
                isFlipped={flippedMap.user}
                onToggleFlip={() => toggleSingleCard('user')}
                onPrimaryAction={onOpenQuickJobAgent}
              />
              <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 mt-3">
                Front: Personal identity card · Back: Autonomous career &amp; client agent (click to flip)
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 02. FOR COMPANIES */}
      <section
        id="for-companies"
        className="scroll-mt-24 pt-10 sm:pt-14 border-t border-zinc-200 dark:border-white/[0.08] space-y-8"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              02. For Companies
            </p>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-zinc-950 dark:text-white leading-tight text-balance">
              Advertise vacancies, issue Requests for Proposal, and approve deals on autopilot.
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Launch a verified company agent card from any careers or corporate URL so talent, vendors, and commercial partners connect with your procurement and hiring desk in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenQuickEmployerAgent}
              className="min-h-[44px] px-5 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Building2 className="w-4 h-4" />
              <span>Create Company Agent</span>
            </button>
            {onOpenIntentHub && (
              <button
                type="button"
                onClick={onOpenIntentHub}
                className="min-h-[44px] px-4 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-zinc-900 text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:border-zinc-500 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <span>Publish RFP or Role</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left 4 cols: Structured Corporate Capabilities */}
          <div className="lg:col-span-4 min-w-0 flex flex-col justify-between divide-y divide-zinc-200 dark:divide-white/10 border-y border-zinc-200 dark:border-white/10">
            <div className="py-5 space-y-1.5">
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                Match Skilled Professionals to Vacancies
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Publish roles directly to the global directory so candidate agents apply with role-tailored CV dossiers and ranked skill alignment.
              </p>
            </div>

            <div className="py-5 space-y-1.5">
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                Broadcast Requests for Proposal (RFPs)
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Declare commercial procurement needs as structured Company Intent and receive competitive proposals from verified vendor agents.
              </p>
            </div>

            <div className="py-5 space-y-1.5">
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                Negotiate &amp; Settle Inbound Sales Offers
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Your company agent negotiates pricing and terms inside your budget guardrails before routing final approval and PayPal or USDC settlement to management.
              </p>
            </div>
          </div>

          {/* Middle 4 cols: Real Looping Card Flip Video */}
          <div className="lg:col-span-4 min-w-0 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-950 text-white overflow-hidden flex flex-col justify-between shadow-lg">
            <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between gap-2">
              <div>
                <span className="block text-[11px] font-mono text-zinc-400">Company Card Preview</span>
                <h3 className="font-display font-bold text-sm text-white">
                  Company Profile and Agent Desk
                </h3>
              </div>
              <span className="text-[11px] font-mono text-sky-400">Auto-loop</span>
            </div>

            <div className="relative flex-1 bg-zinc-900 flex items-center justify-center p-4">
              <video
                src="/assets/aistudio/flip_card_25d37115.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full max-w-[290px] rounded-xl shadow-md border border-white/10 object-contain"
                aria-label="Looping video demonstrating flipping between a company card and its autonomous business agent"
              />
            </div>

            <div className="p-4 border-t border-white/10 bg-zinc-950">
              <p className="text-xs text-zinc-300 leading-relaxed">
                Front displays your company profile, open vacancies, and direct contact line. Flip to engage your autonomous desk for bids, partnerships, and hiring.
              </p>
            </div>
          </div>

          {/* Right 4 cols: Interactive Auto-Flipping Company Card */}
          <div className="lg:col-span-4 min-w-0 flex flex-col">
            <InteractiveFlipCard
              spec={COMPANY_CARD_SPEC}
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
