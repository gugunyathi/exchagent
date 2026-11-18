import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  X,
  Briefcase,
  CheckCircle2,
  CalendarPlus,
  Mail,
  Video,
  ArrowRight,
  Loader2,
  Linkedin,
  UserPlus,
  FileText,
  Sparkles,
} from 'lucide-react';
import {
  AgentDoc,
  AgentApplicationPackage,
  BookingDoc,
  CurrencyMode,
  JobPostingDoc,
  PoppyAuditLogEntry,
  PoppyConsentGrant,
  PoppyOperation,
  RecruitmentMatchDoc,
  formatMoney,
} from '../types/firestore';
import { AGENT_IMAGE_PRESETS } from '../lib/agentImages';
import { LegalDocTab, AI_OUTREACH_DISCLAIMER_TEXT } from '../data/legalDocuments';
import { SwipeScrollArea } from './SwipeScrollArea';
import { emitToast } from '../lib/toast';

interface QuickJobAgentModalProps {
  open: boolean;
  onClose: () => void;
  jobs: JobPostingDoc[];
  currency: CurrencyMode;
  ownerUid: string;
  onCreateAgent: (agent: AgentDoc) => Promise<void>;
  onUpsertMatchesBulk: (matches: RecruitmentMatchDoc[]) => void;
  onAddConsentGrant?: (grant: PoppyConsentGrant) => void;
  onProposeOperation: (op: PoppyOperation) => void;
  onExecuteOperation?: (
    opId: string,
    approver: 'user' | 'agent',
    reference: string,
    matchUpdate?: { matchId: string; nextStatus: RecruitmentMatchDoc['status'] }
  ) => void;
  onAddBooking: (booking: BookingDoc) => Promise<void>;
  onLogAudit: (entry: Omit<PoppyAuditLogEntry, 'id' | 'timestamp'>) => void;
  onOpenHiringDesk: (agentId: string) => void;
  onTailorAndApply?: (
    seeker: AgentDoc,
    job: JobPostingDoc,
    match?: RecruitmentMatchDoc
  ) => Promise<AgentApplicationPackage | null>;
  onOpenProfileHistory?: (agent: AgentDoc, packageId?: string) => void;
  onOpenLegal?: (doc: LegalDocTab) => void;
}

const SAMPLE_PROFILES = [
  {
    label: 'Product & AI Lead',
    url: 'https://www.linkedin.com/in/gugu-nyathi-product-ai',
    note: 'Senior Product & AI Growth Lead · Remote or Hybrid',
  },
  {
    label: 'Cloud & Security',
    url: 'https://www.linkedin.com/in/thabo-nkosi-cloud-security',
    note: 'Principal Cloud, Kubernetes & Zero-Trust Architect',
  },
  {
    label: 'Full-Stack Engineer',
    url: 'https://www.linkedin.com/in/naledi-mokoena-fullstack',
    note: 'React, TypeScript, Node.js & AI Agents',
  },
];

export const QuickJobAgentModal: React.FC<QuickJobAgentModalProps> = ({
  open,
  onClose,
  jobs,
  currency,
  ownerUid,
  onCreateAgent,
  onUpsertMatchesBulk,
  onAddConsentGrant,
  onProposeOperation,
  onExecuteOperation,
  onAddBooking,
  onLogAudit,
  onOpenHiringDesk,
  onTailorAndApply,
  onOpenProfileHistory,
  onOpenLegal,
}) => {
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [focusNote, setFocusNote] = useState('');
  const [acceptedCandidatePrivacy, setAcceptedCandidatePrivacy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [createdAgent, setCreatedAgent] = useState<AgentDoc | null>(null);
  const [deliveredMatches, setDeliveredMatches] = useState<RecruitmentMatchDoc[]>([]);
  const [requestedJobIds, setRequestedJobIds] = useState<Record<string, boolean>>({});
  const [tailoringJobId, setTailoringJobId] = useState<string | null>(null);
  const [tailoredPkgByJobId, setTailoredPkgByJobId] = useState<Record<string, string>>({});
  const [bookingBusyId, setBookingBusyId] = useState<string | null>(null);
  const [batchBookingBusy, setBatchBookingBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const resetForm = () => {
    setCreatedAgent(null);
    setDeliveredMatches([]);
    setRequestedJobIds({});
    setTailoredPkgByJobId({});
    setErrorMsg(null);
  };

  const handleQuickCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmedUrl = linkedinUrl.trim();
    if (!trimmedUrl) {
      setErrorMsg('Paste any Personal URL (LinkedIn, GitHub, portfolio, or site) to create your agent.');
      return;
    }
    if (!acceptedCandidatePrivacy) {
      setErrorMsg('Please accept the SWITCHZ Candidate Terms & AI Privacy Notice to continue.');
      return;
    }

    setCreating(true);
    setErrorMsg(null);

    try {
      const quickRes = await fetch('/api/recruitment/linkedin-quickstart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedinUrl: trimmedUrl,
          focusNote: focusNote.trim(),
          jobs,
        }),
      });
      const data = await quickRes.json();
      if (!quickRes.ok || !data?.profile) {
        throw new Error(data?.error || 'Could not generate your personal agent.');
      }

      const profile = data.profile as {
        displayName: string;
        handle: string;
        normalizedLinkedinUrl: string;
        roleTitle: string;
        headline: string;
        summary: string;
        organization: string;
        yearsExp: number;
        skills: string[];
        preferredRoles: string[];
        salaryMinZAR: number;
        impliedIntent?: AgentDoc['impliedIntent'];
      };

      // Provision a live @agentmail.to inbox for the new Job Search Agent
      let agentEmail = `engage@${profile.handle}`;
      try {
        const mailRes = await fetch('/api/agentmail/inboxes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            handle: profile.handle,
            displayName: profile.displayName,
          }),
        });
        if (mailRes.ok) {
          const mailJson = await mailRes.json();
          if (mailJson?.inbox?.email) {
            agentEmail = mailJson.inbox.email;
          }
        }
      } catch {
        // Fallback smoothly to handle-based address
      }

      const now = new Date().toISOString();
      const agentId = `agent_job_${Date.now()}`;
      const shortNum = String(Math.floor(600 + Math.random() * 380));
      const baseSlug = profile.handle.replace('.agent', '').replace(/[^a-z0-9]/gi, '');
      const personaPresets = AGENT_IMAGE_PRESETS.filter((p) => p.type === 'persona');
      const pickedPortrait =
        personaPresets[Math.floor(Math.random() * Math.max(1, personaPresets.length))]?.src;

      const newAgent: AgentDoc = {
        id: agentId,
        handle: profile.handle,
        ownerUid,
        displayName: profile.displayName,
        roleTitle: profile.roleTitle,
        organization: profile.organization || 'Independent Talent',
        type: 'persona',
        agentRoleCategory: 'job_seeker',
        poppySubdomain: `${baseSlug || 'seeker'}.poppy.switchboard.agent`,
        poppyScopes: ['profile:read', 'cv:read', 'apply', 'calendar', 'poppy:browser-sign-in'],
        cvSummary: {
          headline: profile.headline,
          yearsExp: profile.yearsExp || 5,
          parsedSkills: profile.skills || [],
          preferredRoles: profile.preferredRoles || [profile.roleTitle],
          salaryMinZAR: profile.salaryMinZAR || 85000,
          remoteOnly: false,
          blindScreening: false,
          rawCvExcerpt: `Auto-initialized from ${profile.normalizedLinkedinUrl}${focusNote.trim() ? ` · ${focusNote.trim()}` : ''}`,
        },
        verified: true,
        popiaConsentActive: true,
        voiceNumber: `+27 87 243 ${shortNum}`,
        shortcode: shortNum,
        agentEmail,
        mcpEndpoint: `https://agent.${baseSlug || 'switchboard'}.io/v1/interact`,
        linkedinUrl: profile.normalizedLinkedinUrl,
        brandColor: '#0284c7',
        avatarVariant: 'persona',
        imageUrl: pickedPortrait,
        cardStyle: {
          bannerStyle: 'circuit',
          bannerBgColor: '#0284c7',
          bannerHeight: 'normal',
          bannerBadgeStyle: 'glass',
          backgroundPattern: 'subtle-grid',
          backgroundTheme: 'sapphire',
          edgeRadius: 'rounded-2xl',
          borderStyle: 'hairline',
          borderAccentColor: '#0284c7',
        },
        did: `did:linkedin:${baseSlug || 'seeker'}-agent-v1`,
        protocol: 'Poppy v1.0 / A2A / MCP',
        interactEndpoint: `https://agent.${baseSlug || 'switchboard'}.io/v1/interact`,
        authMethods: 'OAuth2 / Bearer / Public-Key',
        tagline: 'Free Personal Agent · Auto-matching jobs, RFPs & event deals.',
        summary: profile.summary,
        skills: (profile.skills || []).slice(0, 4),
        impliedIntent: profile.impliedIntent || {
          categories: ['career_role', 'commercial_deal', 'event_networking'],
          headline: focusNote.trim() || profile.headline,
          desiredOutcomes: profile.preferredRoles || [profile.roleTitle],
          topics: profile.skills || [],
          targetBudgetMinZAR: profile.salaryMinZAR || 85000,
          preferredRemoteModes: ['Remote', 'Hybrid'],
          maxDistanceMeters: 150,
          autoMatchEnabled: true,
          autoAddProximityContacts: true,
          requireTopicOverlapForAutoAdd: false,
          updatedAt: now,
        },
        guardrails: {
          maxAutoSpendZAR: 0,
          minDiscountPct: 0,
          blockedCategories: ['unverified-spam'],
          workingHoursSAST: '08:00-17:00',
          meetingBufferMins: 15,
          minExecMeetingValueZAR: 0,
        },
        walletAddresses: {
          paypalVaultId: `VAULT_${baseSlug.toUpperCase().slice(0, 8)}`,
        },
        geoLocation: {
          lat: -26.1041 + (Math.random() - 0.5) * 0.02,
          lng: 28.0512 + (Math.random() - 0.5) * 0.02,
          radiusMeters: 150,
          label: 'Remote / Hybrid Candidate Mesh',
        },
        discoverableByPassersby: true,
        passerbyIncentive: 'Open to Interviews · Free Standard Job Agent',
        calendarSyncEnabled: true,
        gmailBridgeEnabled: true,
        createdAt: now,
      };

      const rawMatches = Array.isArray(data.matches) ? data.matches : [];
      const builtMatches: RecruitmentMatchDoc[] = rawMatches.slice(0, 10).map((m: Record<string, unknown>, idx: number) => ({
        id: `match_${m.jobId}_${agentId}_${idx}`,
        jobId: String(m.jobId),
        jobTitle: String(m.jobTitle || 'Matched Role'),
        companyAgentHandle: String(m.companyAgentHandle || 'ceo.woolworths.agent'),
        seekerHandle: newAgent.handle,
        seekerName: newAgent.displayName,
        score: Number(m.score) || 84,
        factors: (m.factors as RecruitmentMatchDoc['factors']) || {
          skillsOverlap: 86,
          experienceFit: 85,
          compensationFit: 88,
          locationCultureFit: 87,
        },
        explanation: String(m.explanation || 'Matched cleanly via LinkedIn Quickstart.'),
        strengths: Array.isArray(m.strengths) ? m.strengths.map(String) : ['Strong domain alignment'],
        gaps: Array.isArray(m.gaps) ? m.gaps.map(String) : ['Team discovery briefing'],
        blindMode: false,
        status: 'suggested',
        interviewPitch: String(m.interviewPitch || ''),
        updatedAt: now,
      }));

      await onCreateAgent(newAgent);
      onUpsertMatchesBulk(builtMatches);

      if (onAddConsentGrant) {
        onAddConsentGrant({
          id: `consent_qs_${Date.now()}`,
          agentHandle: newAgent.handle,
          targetHandle: 'all.hiring.agents',
          scope: 'apply',
          summary: 'Allow 1-click job matching & interview scheduling with Operations v3 confirmation',
          changes: 'reversible',
          personalData: true,
          granted: true,
          grantedAt: now,
        });
      }

      onLogAudit({
        actorHandle: newAgent.handle,
        targetHandle: 'poppy.linkedin-quickstart',
        action: 'JOB_AGENT_CREATED_1CLICK',
        protocol: `Poppy v1.0 (${data.engine || 'gemini-4-hydrogen'})`,
        details: `Created free standard Job Agent from ${profile.normalizedLinkedinUrl} with ${builtMatches.length} free matches & ${agentEmail}.`,
        popiaMinimized: true,
      });

      setCreatedAgent(newAgent);
      setDeliveredMatches(builtMatches);
      emitToast(`Created ${newAgent.handle} with ${builtMatches.length} free job matches`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to create job search agent.';
      setErrorMsg(msg);
      emitToast(msg, 'warning');
    } finally {
      setCreating(false);
    }
  };

  const handleRequestInterview = async (match: RecruitmentMatchDoc, slotOffsetHours = 24) => {
    if (!createdAgent) return;
    setBookingBusyId(match.id);
    try {
      const job = jobs.find((j) => j.id === match.jobId);
      const start = new Date(Date.now() + slotOffsetHours * 60 * 60 * 1000);
      start.setMinutes(0, 0, 0);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const opId = `op_iv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      const bookingId = `book_qs_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

      const op: PoppyOperation = {
        operation_id: opId,
        revision: `rev_qs_${Math.random().toString(36).slice(2, 10)}`,
        actionType: 'book_interview',
        summary: `Request 30m Interview: ${createdAgent.displayName} with ${job?.companyName || match.companyAgentHandle} (${match.jobTitle})`,
        terms: {
          jobId: match.jobId,
          candidateHandle: createdAgent.handle,
          companyHandle: match.companyAgentHandle,
          matchScore: match.score,
          slot: start.toISOString(),
        },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        targetHandle: match.companyAgentHandle,
        actorHandle: createdAgent.handle,
      };
      onProposeOperation(op);
      if (onExecuteOperation) {
        onExecuteOperation(opId, 'agent', `poppy_iv_${Date.now().toString().slice(-6)}`, {
          matchId: match.id,
          nextStatus: 'interview',
        });
      }

      await onAddBooking({
        id: bookingId,
        organizerAgentId: createdAgent.id,
        organizerHandle: createdAgent.handle,
        attendeeAgentId: match.companyAgentHandle,
        attendeeHandle: match.companyAgentHandle,
        ownerUid,
        title: `First-Round Screening Interview: ${match.jobTitle}`,
        jobId: match.jobId,
        jobTitle: match.jobTitle,
        interviewMode: 'live_video',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        meetLink: `switchboard://live-interview/${bookingId}`,
        dealValueZAR: job?.salaryRangeZAR?.[0] || 85000,
        googleSynced: false,
        status: 'CONFIRMED',
      });

      // Dispatch real AgentMail intro email from the agent's @agentmail.to inbox (non-blocking)
      fetch('/api/agentmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inbox: createdAgent.agentEmail,
          to: match.companyAgentHandle.includes('@') ? match.companyAgentHandle : 'exchagent@agentmail.to',
          subject: `Interview Request (${match.score}% Match): ${createdAgent.displayName} for ${match.jobTitle}`,
          text: [
            match.interviewPitch ||
              `Hello ${job?.companyName || match.companyAgentHandle},`,
            '',
            `Agent Handle: ${createdAgent.handle}`,
            `LinkedIn: https://${createdAgent.linkedinUrl || ''}`,
            `Proposed 30m Live Video Slot: ${start.toLocaleString()}`,
            `Core Skills: ${createdAgent.skills.join(', ')}`,
            '',
            '---',
            AI_OUTREACH_DISCLAIMER_TEXT,
          ].join('\n'),
        }),
      }).catch(() => {});

      setRequestedJobIds((prev) => ({ ...prev, [match.jobId]: true }));
      setDeliveredMatches((prev) =>
        prev.map((m) => (m.id === match.id ? { ...m, status: 'interview' } : m))
      );
      emitToast(`Interview booked & pitch dispatched for ${match.jobTitle}`, 'success');
    } finally {
      setBookingBusyId(null);
    }
  };

  const handleAutoRequestTop3 = async () => {
    const top3 = deliveredMatches.filter((m) => !requestedJobIds[m.jobId]).slice(0, 3);
    if (!top3.length) return;
    setBatchBookingBusy(true);
    try {
      for (let i = 0; i < top3.length; i++) {
        await handleRequestInterview(top3[i], 24 + i * 3);
      }
      emitToast(`Requested interviews for your top ${top3.length} job matches`, 'success');
    } finally {
      setBatchBookingBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/60 dark:bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl glass-panel rounded-t-3xl sm:rounded-2xl max-h-[92dvh] overflow-hidden flex flex-col"
      >
        <div className="sm:hidden w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto mt-2 shrink-0" />

        {/* Header with Back + Close buttons */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 pt-3 pb-2.5 border-b border-zinc-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={createdAgent ? resetForm : onClose}
              className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0"
              aria-label={createdAgent ? 'Back to LinkedIn setup' : 'Back'}
              title={createdAgent ? 'Create another' : 'Back'}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-zinc-950 dark:text-white tracking-tight truncate">
                {createdAgent ? 'Your Personal Agent & 10 Free Matches' : '1-Click URL → Personal Agent'}
              </h2>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
                {createdAgent
                  ? `${createdAgent.handle} · ${deliveredMatches.length} free matches ready for interviews & deals`
                  : 'Paste any LinkedIn, GitHub, or portfolio URL to launch a free personal agent card'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0"
            aria-label="Close modal"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <SwipeScrollArea
          direction="vertical"
          arrowSize="sm"
          showArrows={true}
          className="flex-1 min-h-0"
          innerClassName="px-4 sm:px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4"
        >

        {!createdAgent ? (
          <form onSubmit={handleQuickCreate} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block mb-1.5">
                  Personal URL (LinkedIn, Portfolio, GitHub, or Personal Site)
                </label>
                <div className="flex items-center rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 h-11 focus-within:border-sky-600 dark:focus-within:border-sky-400 transition-colors">
                  <Linkedin className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mr-2" />
                  <input
                    type="text"
                    required
                    autoFocus
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/you or https://yourname.dev"
                    className="w-full bg-transparent text-xs sm:text-sm text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1.5">
                  Target Role or Focus (optional)
                </label>
                <input
                  type="text"
                  value={focusNote}
                  onChange={(e) => setFocusNote(e.target.value)}
                  placeholder="e.g. Product Manager, Cloud Security, B2B Growth · Remote"
                  className="w-full min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
                />
              </div>

              {/* 1-Click Starter Samples */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">
                  Quick test profiles (click to fill)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_PROFILES.map((sample) => (
                    <button
                      key={sample.url}
                      type="button"
                      onClick={() => {
                        setLinkedinUrl(sample.url);
                        setFocusNote(sample.note);
                        setErrorMsg(null);
                      }}
                      className="min-h-[32px] px-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-500 dark:hover:border-white/30 transition-colors"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* What Gets Created Automatically */}
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 p-3.5 space-y-2">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Included automatically in 1 click
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-zinc-700 dark:text-zinc-300">
                <div className="flex items-start gap-2">
                  <UserPlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>Free verified human <span className="font-mono font-semibold">.agent</span> card ($0.00)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                  <span><span className="font-semibold">10 free</span> AI-scored job matches &amp; interview pitches</span>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>Live <span className="font-mono font-semibold">@agentmail.to</span> inbox &amp; 1-click interview booking</span>
                </div>
              </div>
            </div>

            {/* Candidate Terms & Global AI Privacy Clickwrap */}
            <label className="flex items-start gap-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedCandidatePrivacy}
                onChange={(e) => {
                  setAcceptedCandidatePrivacy(e.target.checked);
                  if (e.target.checked) setErrorMsg(null);
                }}
                className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-sky-600 focus:ring-sky-500 shrink-0"
              />
              <span className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed">
                I accept the SWITCHZ{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onOpenLegal) {
                      onClose();
                      onOpenLegal('privacy');
                    }
                  }}
                  className="font-semibold underline text-zinc-950 dark:text-white hover:text-sky-600"
                >
                  Candidate Terms &amp; AI Privacy Notice (/terms)
                </button>{' '}
                (Silvernest Pty Ltd, South Africa) and consent to AI-assisted CV matching, anti-deepfake liveness verification, and cross-border profile sharing upon my per-role confirmation.
              </span>
            </label>

            {errorMsg && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{errorMsg}</p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] px-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !acceptedCandidatePrivacy}
                className="min-h-[42px] w-full sm:w-auto px-5 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Building Agent &amp; Matching 10 Jobs...
                  </>
                ) : (
                  <>
                    <Briefcase className="w-3.5 h-3.5" />
                    Create Job Agent &amp; Get 10 Free Matches
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Created Standard Job Agent Strip */}
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Standard Free Human Job Agent Active</span>
                </div>
                <p className="font-display text-sm font-bold text-zinc-950 dark:text-white truncate">
                  {createdAgent.displayName} · <span className="font-mono font-medium">{createdAgent.handle}</span>
                </p>
                <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
                  {createdAgent.agentEmail} · {createdAgent.linkedinUrl}
                </p>
                <p className="text-[11px] text-zinc-700 dark:text-zinc-300">
                  Skills: {createdAgent.skills.join(' · ')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {onOpenProfileHistory && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = createdAgent;
                      onClose();
                      onOpenProfileHistory(target);
                    }}
                    className="min-h-[38px] px-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:border-zinc-500 inline-flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    History &amp; Docs
                  </button>
                )}
                <button
                  type="button"
                  disabled={batchBookingBusy}
                  onClick={handleAutoRequestTop3}
                  className="min-h-[38px] px-3.5 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  {batchBookingBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CalendarPlus className="w-3.5 h-3.5" />
                  )}
                  Auto-Request Top 3 Interviews
                </button>
              </div>
            </div>

            {/* 10 Free Job Matches */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {deliveredMatches.length} Free Job Matches Ranked by Fit
                </span>
                <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                  {Object.keys(requestedJobIds).length} interview(s) requested
                </span>
              </div>

              <SwipeScrollArea
                direction="vertical"
                arrowSize="sm"
                showArrows={true}
                className="max-h-[40dvh]"
                innerClassName="space-y-2 pr-1"
              >
                {deliveredMatches.map((m, idx) => {
                  const job = jobs.find((j) => j.id === m.jobId);
                  const booked = Boolean(requestedJobIds[m.jobId]);
                  return (
                    <div
                      key={m.id}
                      className="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                          <span>#{idx + 1}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">{m.score}% Fit</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{job?.companyName || m.companyAgentHandle}</span>
                          {job && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{job.remoteMode}</span>
                            </>
                          )}
                        </div>
                        <p className="font-display text-xs sm:text-sm font-bold text-zinc-950 dark:text-zinc-50 truncate">
                          {m.jobTitle}
                        </p>
                        {job && (
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 tabular-nums">
                            {formatMoney(job.salaryRangeZAR[0], currency)}–{formatMoney(job.salaryRangeZAR[1], currency)}/mo · {job.regionZone || job.location}
                          </p>
                        )}
                        <p className="text-[11px] text-zinc-700 dark:text-zinc-300 line-clamp-2">
                          {m.explanation}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {job && onTailorAndApply && (
                          tailoredPkgByJobId[job.id] && onOpenProfileHistory ? (
                            <button
                              type="button"
                              onClick={() => {
                                const target = createdAgent;
                                const pkgId = tailoredPkgByJobId[job.id];
                                onClose();
                                onOpenProfileHistory(target, pkgId);
                              }}
                              className="min-h-[34px] px-2.5 rounded-lg bg-sky-50 border border-sky-300 text-sky-800 dark:bg-sky-500/15 dark:border-sky-400/30 dark:text-sky-300 text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              View CV/PDF
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={tailoringJobId === job.id}
                              onClick={async () => {
                                setTailoringJobId(job.id);
                                try {
                                  const pkg = await onTailorAndApply(createdAgent, job, m);
                                  if (pkg) {
                                    setTailoredPkgByJobId((prev) => ({ ...prev, [job.id]: pkg.id }));
                                  }
                                } finally {
                                  setTailoringJobId(null);
                                }
                              }}
                              className="min-h-[34px] px-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:border-zinc-500 inline-flex items-center gap-1 whitespace-nowrap disabled:opacity-60"
                            >
                              {tailoringJobId === job.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                              )}
                              {tailoringJobId === job.id ? 'Tailoring...' : 'Tailor CV & Apply'}
                            </button>
                          )
                        )}
                        <button
                          type="button"
                          disabled={booked || bookingBusyId === m.id}
                          onClick={() => handleRequestInterview(m, 24 + idx * 2)}
                          className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                            booked
                              ? 'bg-emerald-50 border border-emerald-300 text-emerald-800 dark:bg-emerald-500/15 dark:border-emerald-400/30 dark:text-emerald-300'
                              : 'bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white'
                          }`}
                        >
                          {bookingBusyId === m.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : booked ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <CalendarPlus className="w-3.5 h-3.5" />
                          )}
                          {booked ? 'Interview Booked' : 'Get Interview'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </SwipeScrollArea>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-200 dark:border-white/10">
              <button
                type="button"
                onClick={resetForm}
                className="min-h-[38px] px-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
              >
                Create Another
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = createdAgent.id;
                  onClose();
                  onOpenHiringDesk(id);
                }}
                className="min-h-[40px] w-full sm:w-auto px-4 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <Video className="w-3.5 h-3.5" />
                Open Full Hiring &amp; Interview Desk
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        </SwipeScrollArea>
      </div>
    </div>
  );
};
