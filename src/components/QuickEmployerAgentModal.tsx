import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  X,
  Building2,
  CheckCircle2,
  CalendarPlus,
  Video,
  ArrowRight,
  Loader2,
  Globe,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  AgentDoc,
  BookingDoc,
  CurrencyMode,
  JobPostingDoc,
  PoppyAuditLogEntry,
  PoppyOperation,
  RecruitmentMatchDoc,
  formatMoney,
} from '../types/firestore';
import { AGENT_IMAGE_PRESETS } from '../lib/agentImages';
import { LegalDocTab } from '../data/legalDocuments';
import { SwipeScrollArea } from './SwipeScrollArea';
import { emitToast } from '../lib/toast';

interface QuickEmployerAgentModalProps {
  open: boolean;
  onClose: () => void;
  candidates: AgentDoc[];
  currency: CurrencyMode;
  ownerUid: string;
  onCreateAgent: (agent: AgentDoc) => Promise<void>;
  onCreateJobsBulk: (jobs: JobPostingDoc[]) => void;
  onUpsertMatchesBulk: (matches: RecruitmentMatchDoc[]) => void;
  onProposeOperation: (op: PoppyOperation) => void;
  onExecuteOperation?: (
    opId: string,
    approver: 'user' | 'agent',
    reference: string,
    matchUpdate?: { matchId: string; nextStatus: RecruitmentMatchDoc['status'] }
  ) => void;
  onAddBooking: (booking: BookingDoc) => Promise<void>;
  onLogAudit: (entry: Omit<PoppyAuditLogEntry, 'id' | 'timestamp'>) => void;
  onOpenHiringDesk: (companyHandle: string) => void;
  onOpenLegal?: (doc: LegalDocTab) => void;
}

const SAMPLE_JOB_LISTINGS = [
  {
    company: 'Takealot Group',
    label: 'Takealot · Logistics & Checkout PM',
    url: 'https://careers.takealot.com/jobs/pm-checkout-ai',
    dept: 'Logistics & Autonomous Systems',
  },
  {
    company: 'MTN Group',
    label: 'MTN · Cloud & Zero-Trust Architect',
    url: 'https://mtn.bamboohr.com/jobs/cloud-security-lead',
    dept: 'Enterprise Cloud & Telecom Security',
  },
  {
    company: 'Woolworths',
    label: 'Woolworths · Agentic Commerce Lead',
    url: 'https://careers.woolworths.co.za/jobs/agentic-commerce-lead',
    dept: 'Digital Commerce & B2B Loyalty',
  },
  {
    company: 'Discovery Health',
    label: 'Discovery · Health-Tech AI Lead',
    url: 'https://careers.discovery.co.za/jobs/healthtech-ai-lead',
    dept: 'Vitality & Predictive Health Systems',
  },
];

export const QuickEmployerAgentModal: React.FC<QuickEmployerAgentModalProps> = ({
  open,
  onClose,
  candidates,
  currency,
  ownerUid,
  onCreateAgent,
  onCreateJobsBulk,
  onUpsertMatchesBulk,
  onProposeOperation,
  onExecuteOperation,
  onAddBooking,
  onLogAudit,
  onOpenHiringDesk,
  onOpenLegal,
}) => {
  const [jobUrl, setJobUrl] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [department, setDepartment] = useState('');
  const [acceptedEmployerTerms, setAcceptedEmployerTerms] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [createdAgent, setCreatedAgent] = useState<AgentDoc | null>(null);
  const [createdJobs, setCreatedJobs] = useState<JobPostingDoc[]>([]);
  const [deliveredMatches, setDeliveredMatches] = useState<RecruitmentMatchDoc[]>([]);
  const [invitedCandidateIds, setInvitedCandidateIds] = useState<Record<string, boolean>>({});
  const [bookingBusyId, setBookingBusyId] = useState<string | null>(null);
  const [batchInviting, setBatchInviting] = useState(false);

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

  const handleReset = () => {
    setJobUrl('');
    setCompanyName('');
    setDepartment('');
    setCreatedAgent(null);
    setCreatedJobs([]);
    setDeliveredMatches([]);
    setInvitedCandidateIds({});
    setErrorMsg(null);
  };

  const handleQuickCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmedUrl = jobUrl.trim();
    if (!trimmedUrl) {
      setErrorMsg('Please enter a job listing or careers page URL.');
      return;
    }
    if (!acceptedEmployerTerms) {
      setErrorMsg('Please accept the SWITCHZ Employer Recruitment Agreement & Fee Schedule to continue.');
      return;
    }

    setCreating(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/recruitment/employer-quickstart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobUrl: trimmedUrl,
          companyName: companyName.trim(),
          department: department.trim(),
          candidates,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.employerAgent || !data?.jobs) {
        throw new Error(data?.error || 'Failed to create employer agent from URL.');
      }

      const agentData = data.employerAgent as AgentDoc;
      const jobsData = data.jobs as JobPostingDoc[];
      const matchesData = (data.candidateMatches || []) as RecruitmentMatchDoc[];

      let agentEmail = agentData.agentEmail || `talent@${agentData.handle}`;
      try {
        const mailRes = await fetch('/api/agentmail/inboxes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            handle: agentData.handle,
            displayName: agentData.displayName,
          }),
        });
        if (mailRes.ok) {
          const mailJson = await mailRes.json();
          if (mailJson?.inbox?.email) {
            agentEmail = mailJson.inbox.email;
          }
        }
      } catch {
        // Fallback cleanly to handle address
      }

      const businessPresets = AGENT_IMAGE_PRESETS.filter((p) => p.type === 'business');
      const pickedImage = businessPresets[Math.floor(Math.random() * Math.max(1, businessPresets.length))]?.src;

      const finalAgent: AgentDoc = {
        ...agentData,
        ownerUid,
        agentEmail,
        imageUrl: agentData.imageUrl || pickedImage,
      };

      await onCreateAgent(finalAgent);
      onCreateJobsBulk(jobsData);
      onUpsertMatchesBulk(matchesData);

      onLogAudit({
        actorHandle: finalAgent.handle,
        targetHandle: finalAgent.poppySubdomain || 'switchboard.agent',
        action: 'EMPLOYER_AGENT_DEPLOYED',
        protocol: 'Poppy v1.0',
        details: `Created Employer Agent for ${finalAgent.displayName} from ${trimmedUrl}. Posted ${jobsData.length} vacancies and auto-matched ${matchesData.length} candidates.`,
        popiaMinimized: true,
      });

      setCreatedAgent(finalAgent);
      setCreatedJobs(jobsData);
      setDeliveredMatches(matchesData);
      emitToast(`Employer agent deployed for ${finalAgent.displayName}!`, 'success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error creating employer agent');
    } finally {
      setCreating(false);
    }
  };

  const handleInviteCandidate = async (match: RecruitmentMatchDoc) => {
    if (!createdAgent) return;
    setBookingBusyId(match.id);

    try {
      const now = new Date();
      const interviewDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const bookingId = `book_invite_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const opId = `op_invite_${Date.now()}`;
      const timeStr = `${interviewDate.toISOString().split('T')[0]} 14:00 SAST`;

      const newBooking: BookingDoc = {
        id: bookingId,
        organizerAgentId: createdAgent.id,
        organizerHandle: createdAgent.handle,
        attendeeAgentId: match.seekerHandle,
        attendeeHandle: match.seekerHandle,
        ownerUid,
        title: `Screening Interview: ${match.jobTitle}`,
        jobId: match.jobId,
        jobTitle: match.jobTitle,
        interviewMode: 'live_video',
        startTime: interviewDate.toISOString(),
        endTime: new Date(interviewDate.getTime() + 30 * 60 * 1000).toISOString(),
        meetLink: `switchboard://live-interview/${bookingId}`,
        dealValueZAR: 90000,
        googleSynced: false,
        status: 'CONFIRMED',
      };

      await onAddBooking(newBooking);

      const op: PoppyOperation = {
        operation_id: opId,
        revision: 'v3',
        actionType: 'book_interview',
        summary: `Employer interview invitation confirmed for ${match.seekerName} (${match.jobTitle})`,
        terms: {
          jobId: match.jobId,
          jobTitle: match.jobTitle,
          company: createdAgent.displayName,
          candidate: match.seekerName,
          bookingId,
          fitScore: match.score,
        },
        expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'performed',
        createdAt: now.toISOString(),
        executedAt: now.toISOString(),
        actorHandle: createdAgent.handle,
        targetHandle: match.seekerHandle,
        approver: 'agent',
        reference: `INVITE_CAL_${bookingId}`,
      };

      onProposeOperation(op);
      onExecuteOperation?.(opId, 'agent', `INVITE_CAL_${bookingId}`, {
        matchId: match.id,
        nextStatus: 'interview',
      });

      try {
        await fetch('/api/agentmail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderHandle: createdAgent.handle,
            to: `engage@${match.seekerHandle}`,
            subject: `Interview Invitation: ${match.jobTitle} at ${createdAgent.displayName}`,
            text: `Hi ${match.seekerName},\n\n${createdAgent.displayName} reviewed your verified .agent profile for "${match.jobTitle}" (${match.score}% match) and has scheduled a 30-minute Poppy screening interview on ${timeStr}.\n\nBooking ID: ${bookingId}\nPoppy Protocol: v1.0 Operations v3\n\nBest regards,\n${createdAgent.displayName} Talent Desk`,
          }),
        });
      } catch {
        // email fallback
      }

      onLogAudit({
        actorHandle: createdAgent.handle,
        targetHandle: match.seekerHandle,
        action: 'INTERVIEW_INVITED',
        protocol: 'Poppy v1.0 + operations/v3',
        operationId: opId,
        reference: bookingId,
        details: `Interview invite confirmed for ${match.seekerName} (${match.jobTitle}) with ${createdAgent.displayName}.`,
        popiaMinimized: true,
      });

      setInvitedCandidateIds((prev) => ({ ...prev, [match.id]: true }));
      setDeliveredMatches((prev) =>
        prev.map((m) => (m.id === match.id ? { ...m, status: 'interview' } : m))
      );
      emitToast(`Interview invite sent to ${match.seekerName}!`, 'success');
    } catch (err) {
      emitToast(err instanceof Error ? err.message : 'Could not schedule interview invite', 'error');
    } finally {
      setBookingBusyId(null);
    }
  };

  const handleInviteTopCandidatesBatch = async () => {
    if (!createdAgent || deliveredMatches.length === 0) return;
    setBatchInviting(true);
    const topCandidates = deliveredMatches.slice(0, 3).filter((m) => !invitedCandidateIds[m.id]);
    for (const match of topCandidates) {
      await handleInviteCandidate(match);
    }
    setBatchInviting(false);
    emitToast(`Invited top ${topCandidates.length} candidates for screening!`, 'success');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl glass-panel rounded-t-3xl sm:rounded-2xl border border-zinc-300 dark:border-white/15 max-h-[92dvh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto mt-2 shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 pt-3 pb-3 border-b border-zinc-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={createdAgent ? handleReset : onClose}
              className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0 transition-colors"
              aria-label="Back"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-zinc-950 dark:text-white tracking-tight flex items-center gap-2 truncate">
                <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">1-Click Employer Agent &amp; Vacancy Poster</span>
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                Add job listing URL · Auto-create verified hiring agent · Auto-match candidate agents
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center shrink-0 ml-1 transition-colors"
            aria-label="Close"
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
          innerClassName="px-4 sm:px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4"
        >

        {/* Step 1: Input Form */}
        {!createdAgent ? (
          <form onSubmit={handleQuickCreate} className="space-y-4">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 p-3 text-xs text-emerald-950 dark:text-emerald-200 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Instant Business Onboarding &amp; Automated Candidate Matching
              </p>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
                Paste your open job or careers listing URL. SWITCHZ generates a verified enterprise `.agent` card, extracts vacancies, provisions an <span className="font-mono font-semibold">@agentmail.to</span> hiring desk, and scores candidate agents with one-click interview invites.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block mb-1">
                  Job Posting or Careers URL <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="url"
                    required
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                    placeholder="https://careers.takealot.com/jobs/senior-agent-lead"
                    className="w-full min-h-[42px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 pl-9 pr-3 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-400 font-mono"
                  />
                </div>
              </div>

              {/* Sample 1-Click Job URLs */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  Or pick a sample job listing:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {SAMPLE_JOB_LISTINGS.map((sample) => (
                    <button
                      key={sample.company}
                      type="button"
                      onClick={() => {
                        setJobUrl(sample.url);
                        setCompanyName(sample.company);
                        setDepartment(sample.dept);
                      }}
                      className="min-h-[34px] px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 hover:border-emerald-500 dark:hover:border-emerald-500/60 text-left text-[11px] font-medium text-zinc-800 dark:text-zinc-200 transition-colors flex items-center justify-between gap-1"
                    >
                      <span className="truncate">{sample.label}</span>
                      <span className="text-[9.5px] font-mono text-emerald-600 dark:text-emerald-400 shrink-0">Use</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block mb-1">
                    Company Name <span className="text-zinc-400 font-normal">(optional, auto-derived)</span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Takealot Group"
                    className="w-full min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block mb-1">
                    Department / Team <span className="text-zinc-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Logistics & Autonomous Systems"
                    className="w-full min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-400"
                  />
                </div>
              </div>
            </div>

            {/* Employer Master Recruitment Agreement Clickwrap */}
            <label className="flex items-start gap-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedEmployerTerms}
                onChange={(e) => {
                  setAcceptedEmployerTerms(e.target.checked);
                  if (e.target.checked) setErrorMsg(null);
                }}
                className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
              />
              <span className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed">
                I am authorized to bind <span className="font-semibold text-zinc-950 dark:text-white">{companyName.trim() || '[Company Name]'}</span> and accept the SWITCHZ{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onOpenLegal) {
                      onClose();
                      onOpenLegal('terms');
                    }
                  }}
                  className="font-semibold underline text-zinc-950 dark:text-white hover:text-emerald-600"
                >
                  Platform Terms (/term)
                </button>{' '}
                &amp;{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onOpenLegal) {
                      onClose();
                      onOpenLegal('employer');
                    }
                  }}
                  className="font-semibold underline text-zinc-950 dark:text-white hover:text-emerald-600"
                >
                  Global Recruitment Agreement (/employeragreement)
                </button>{' '}
                with Silvernest Pty Ltd (South Africa), including applicable placement fees (20%–30% or $5,000 USD remote flat fee), Net 14 payment terms, and 12-month candidate ownership.
              </span>
            </label>

            {errorMsg && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl p-2.5">
                {errorMsg}
              </p>
            )}

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <span className="text-[11px] text-zinc-500">
                Poppy v1.0 verified protocol · Zero scraping
              </span>
              <button
                type="submit"
                disabled={creating || !acceptedEmployerTerms}
                className="min-h-[42px] w-full sm:w-auto px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing &amp; Matching...</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4" />
                    <span>Create Employer Agent &amp; Post</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: Results View (Agent Card, Vacancies, and Auto-Matched Candidates) */
          <div className="space-y-4">
            {/* Newly Created Employer Agent Banner */}
            <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/70 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {createdAgent.imageUrl ? (
                    <img
                      src={createdAgent.imageUrl}
                      alt={createdAgent.displayName}
                      className="w-12 h-12 rounded-xl object-cover border border-zinc-300 dark:border-white/15"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                      {createdAgent.brandLogoCode || 'EMP'}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-bold text-sm text-zinc-950 dark:text-white">
                        {createdAgent.displayName}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-[10px] font-mono text-emerald-800 dark:text-emerald-300 font-semibold">
                        VERIFIED BUSINESS
                      </span>
                    </div>
                    <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {createdAgent.handle} · <span className="text-sky-700 dark:text-sky-400">{createdAgent.agentEmail}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenHiringDesk(createdAgent.handle);
                    }}
                    className="min-h-[36px] px-3.5 rounded-xl bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>Open Hiring Desk</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Vacancies Posted */}
              <div className="pt-2 border-t border-zinc-200 dark:border-white/10 space-y-1.5">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
                  Live Vacancies Posted ({createdJobs.length})
                </span>
                <div className="space-y-1.5">
                  {createdJobs.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-950 dark:text-white truncate">
                          {job.title}
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate">
                          {job.remoteMode} · {job.location} · {formatMoney(job.salaryRangeZAR[0], currency)} - {formatMoney(job.salaryRangeZAR[1], currency)}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-[10px] font-mono text-emerald-800 dark:text-emerald-300 font-semibold shrink-0">
                        OPEN
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Candidate Auto-Matches Strip */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-display font-bold text-xs text-zinc-950 dark:text-white flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span>Auto-Matched Candidate Agents ({deliveredMatches.length})</span>
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    Instant screening fit calculated across verified candidate agent profiles
                  </p>
                </div>
                {deliveredMatches.length > 0 && (
                  <button
                    type="button"
                    onClick={handleInviteTopCandidatesBatch}
                    disabled={batchInviting}
                    className="min-h-[32px] px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50 shrink-0"
                  >
                    {batchInviting ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Inviting...</span>
                      </>
                    ) : (
                      <>
                        <Video className="w-3 h-3" />
                        <span>Invite Top 3</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <SwipeScrollArea
                direction="vertical"
                arrowSize="sm"
                showArrows={true}
                className="max-h-72"
                innerClassName="space-y-2 pr-1"
              >
                {deliveredMatches.map((match) => {
                  const isInvited = invitedCandidateIds[match.id] || match.status === 'interview';
                  const isBusy = bookingBusyId === match.id;
                  return (
                    <div
                      key={match.id}
                      className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/90 p-3 space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-zinc-950 dark:text-white truncate">
                              {match.seekerName}
                            </span>
                            <span className="font-mono text-[11px] text-zinc-500 truncate">
                              {match.seekerHandle}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                            {match.explanation}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-500/40 text-[11px] font-mono font-bold text-sky-800 dark:text-sky-300">
                            {match.score}% Fit
                          </span>
                          <button
                            type="button"
                            onClick={() => handleInviteCandidate(match)}
                            disabled={isInvited || isBusy}
                            className={`min-h-[32px] px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors ${
                              isInvited
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300'
                                : 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white'
                            }`}
                          >
                            {isInvited ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Invited</span>
                              </>
                            ) : isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <CalendarPlus className="w-3.5 h-3.5" />
                                <span>Invite</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Factor badges */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                        <span>Skills: {match.factors.skillsOverlap}%</span>
                        <span>·</span>
                        <span>Exp: {match.factors.experienceFit}%</span>
                        <span>·</span>
                        <span>Comp: {match.factors.compensationFit}%</span>
                      </div>
                    </div>
                  );
                })}
              </SwipeScrollArea>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white underline"
              >
                Post another job URL
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[36px] px-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-200"
              >
                Done
              </button>
            </div>
          </div>
        )}
        </SwipeScrollArea>
      </div>
    </div>
  );
};
