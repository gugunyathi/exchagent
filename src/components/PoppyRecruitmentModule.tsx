import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  UserCheck,
  Building2,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  XCircle,
  Lock,
  EyeOff,
  Eye,
  ExternalLink,
  MessageSquare,
  Send,
  RefreshCw,
  AlertTriangle,
  Globe,
  FileCheck2,
  Plus,
  Handshake,
  Link as LinkIcon,
  ShieldAlert,
  Video,
} from 'lucide-react';
import {
  AgentDoc,
  JobPostingDoc,
  RecruitmentMatchDoc,
  PoppyOperation,
  PoppyConsentGrant,
  PoppyAuditLogEntry,
  PoppyConversation,
  SeekerCvProfile,
  BookingDoc,
  InterviewVideoRecord,
  PreScreenReview,
  CurrencyMode,
  formatMoney,
} from '../types/firestore';
import {
  OFFICIAL_POPPY_EXTENSIONS,
  validatePoppyDocument,
  PoppyValidationReport,
} from '../services/poppyProtocol';
import { VideoInterviewStudioPanel } from './VideoInterviewStudioPanel';
import { LiveInterviewRoomModal } from './LiveInterviewRoomModal';
import { SwipeScrollArea } from './SwipeScrollArea';

interface PoppyRecruitmentModuleProps {
  agents: AgentDoc[];
  jobs: JobPostingDoc[];
  matches: RecruitmentMatchDoc[];
  bookings: BookingDoc[];
  poppyOperations: PoppyOperation[];
  poppyConsents: PoppyConsentGrant[];
  poppyAuditLogs: PoppyAuditLogEntry[];
  currency: CurrencyMode;
  workspaceToken: string | null;
  ownerUid: string;
  initialRoleTab?: 'seeker' | 'hiring' | 'recruiter' | 'video_live';
  initialSeekerId?: string | null;
  onCreateJob: (job: JobPostingDoc) => void;
  onUpdateSeekerCv: (agentId: string, cv: SeekerCvProfile) => void;
  onSaveVideo: (agentId: string, video: InterviewVideoRecord) => void;
  onAddPreScreenReview: (agentId: string, review: PreScreenReview) => void;
  onAddBooking: (booking: BookingDoc) => Promise<void>;
  onConnectGoogle: () => Promise<unknown>;
  onUpsertMatch: (match: RecruitmentMatchDoc) => void;
  onProposeOperation: (op: PoppyOperation) => void;
  onExecuteOperation: (
    opId: string,
    approver: 'user' | 'agent',
    reference: string,
    matchUpdate?: { matchId: string; nextStatus: RecruitmentMatchDoc['status'] }
  ) => void;
  onDeclineOperation: (opId: string) => void;
  onToggleConsentScope: (consentId: string) => void;
  onRevokeAllConsents: () => void;
  onLogAudit: (entry: Omit<PoppyAuditLogEntry, 'id' | 'timestamp'>) => void;
}

type HubSection = 'recruitment' | 'conversations' | 'consent_spec';
type RecruitmentRoleTab = 'seeker' | 'hiring' | 'recruiter' | 'video_live';

export const PoppyRecruitmentModule: React.FC<PoppyRecruitmentModuleProps> = ({
  agents,
  jobs,
  matches,
  bookings,
  poppyOperations,
  poppyConsents,
  poppyAuditLogs,
  currency,
  workspaceToken,
  ownerUid,
  initialRoleTab,
  initialSeekerId,
  onCreateJob,
  onUpdateSeekerCv,
  onSaveVideo,
  onAddPreScreenReview,
  onAddBooking,
  onConnectGoogle,
  onUpsertMatch,
  onProposeOperation,
  onExecuteOperation,
  onDeclineOperation,
  onToggleConsentScope,
  onRevokeAllConsents,
  onLogAudit,
}) => {
  const [section, setSection] = useState<HubSection>('recruitment');
  const [roleTab, setRoleTab] = useState<RecruitmentRoleTab>(initialRoleTab || 'seeker');
  const [liveRoomState, setLiveRoomState] = useState<{
    open: boolean;
    candidate: AgentDoc | null;
    job?: JobPostingDoc | null;
    booking?: BookingDoc | null;
    interviewerHandle: string;
    interviewerName: string;
  }>({
    open: false,
    candidate: null,
    interviewerHandle: 'ceo.woolworths.agent',
    interviewerName: 'Woolworths Talent Panel',
  });

  // Job Seeker state
  const personas = agents.filter((a) => a.type === 'persona');
  const businesses = agents.filter((a) => a.type === 'business' && a.handle !== '911.emergency.agent');
  const [selectedSeekerId, setSelectedSeekerId] = useState<string>(initialSeekerId || personas[0]?.id || '');
  const selectedSeeker = personas.find((p) => p.id === selectedSeekerId) || personas[0];

  useEffect(() => {
    if (initialRoleTab) {
      setSection('recruitment');
      setRoleTab(initialRoleTab);
    }
    if (initialSeekerId) {
      setSelectedSeekerId(initialSeekerId);
    }
  }, [initialRoleTab, initialSeekerId]);

  const [cvInputText, setCvInputText] = useState<string>(
    '8+ years leading Full Stack B2B Growth, Marketing Automation, HubSpot CRM, SQL revenue attribution, and AI outbound pipelines in Johannesburg. Seeking R85,000+ / mo hybrid or remote.'
  );
  const [linkedinInput, setLinkedinInput] = useState<string>(
    selectedSeeker?.linkedinUrl || 'linkedin.com/in/chrismoleme'
  );
  const [parsingCv, setParsingCv] = useState(false);

  // Hiring Job Composer state
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [jobCompanyHandle, setJobCompanyHandle] = useState<string>(
    businesses[0]?.handle || 'ceo.woolworths.agent'
  );
  const [jobTitle, setJobTitle] = useState('Staff Agentic Commerce Architect');
  const [jobSkillsText, setJobSkillsText] = useState(
    'TypeScript, Poppy Protocol, Growth Automation, Zero-Trust Security'
  );
  const [jobSalaryMin, setJobSalaryMin] = useState(95000);
  const [jobSalaryMax, setJobSalaryMax] = useState(140000);
  const [jobAutonomy, setJobAutonomy] = useState<JobPostingDoc['autonomyLevel']>(
    'shortlist_auto_offer_approve'
  );
  const [matchingBusyId, setMatchingBusyId] = useState<string | null>(null);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(matches[0]?.id || null);

  // Pending Operations v3 Confirmation Modal / Card
  const [pendingActionMatchUpdate, setPendingActionMatchUpdate] = useState<{
    opId: string;
    matchId: string;
    nextStatus: RecruitmentMatchDoc['status'];
  } | null>(null);
  const [executingOpId, setExecutingOpId] = useState<string | null>(null);
  const [idempotentBanner, setIdempotentBanner] = useState<string | null>(null);

  // Poppy Conversation & Extensions Console state
  const [convTarget, setConvTarget] = useState<string>(businesses[0]?.handle || 'ceo.woolworths.agent');
  const [enabledExtensions, setEnabledExtensions] = useState<Record<string, boolean>>({
    operations: true,
    links: true,
    disclosures: true,
    'browser-control': true,
    'mediated-sign-in': false,
    ucp: true,
  });
  const [activeConv, setActiveConv] = useState<PoppyConversation | null>(null);
  const [convMsg, setConvMsg] = useState('Requesting role availability and salary guardrails for application.');
  const [convBusy, setConvBusy] = useState(false);
  const [tasksData, setTasksData] = useState<string>('');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);
  const [browserJoinInfo, setBrowserJoinInfo] = useState<string | null>(null);

  // Spec Validator & Discovery Inspector state
  const [manifestPath, setManifestPath] = useState<string>('/.well-known/poppy.json');
  const [manifestRaw, setManifestRaw] = useState<string>('');
  const [validationReport, setValidationReport] = useState<PoppyValidationReport | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);

  const pendingOperations = poppyOperations.filter((o) => o.status === 'pending');

  const handleParseCv = async () => {
    if (!selectedSeeker) return;
    setParsingCv(true);
    try {
      const res = await fetch('/api/recruitment/cv-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cvText: cvInputText,
          linkedinUrl: linkedinInput,
          rolePreference: selectedSeeker.roleTitle,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.parsedSkills)) {
        onUpdateSeekerCv(selectedSeeker.id, {
          headline: data.headline || selectedSeeker.roleTitle,
          yearsExp: data.yearsExp || 6,
          parsedSkills: data.parsedSkills,
          preferredRoles: data.preferredRoles || [selectedSeeker.roleTitle],
          salaryMinZAR: data.salaryMinZAR || 85000,
          blindScreening: selectedSeeker.cvSummary?.blindScreening ?? false,
          rawCvExcerpt: cvInputText.slice(0, 240),
        });
        onLogAudit({
          actorHandle: selectedSeeker.handle,
          targetHandle: 'poppy.cv-parser',
          action: 'CV_SKILLS_PARSED',
          protocol: 'Poppy v1.0 (Zero LinkedIn Scraping)',
          details: `Extracted ${data.parsedSkills.length} verified skills from user-submitted CV.`,
          popiaMinimized: true,
        });
      }
    } finally {
      setParsingCv(false);
    }
  };

  const handleToggleBlindScreening = () => {
    if (!selectedSeeker) return;
    const current = selectedSeeker.cvSummary || {
      headline: selectedSeeker.roleTitle,
      yearsExp: 6,
      parsedSkills: selectedSeeker.skills,
      preferredRoles: [selectedSeeker.roleTitle],
      salaryMinZAR: 85000,
      blindScreening: false,
    };
    onUpdateSeekerCv(selectedSeeker.id, {
      ...current,
      blindScreening: !current.blindScreening,
    });
  };

  const handleRunMatchForJob = async (job: JobPostingDoc, seeker: AgentDoc) => {
    setMatchingBusyId(job.id);
    try {
      const cv = seeker.cvSummary;
      const res = await fetch('/api/recruitment/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job,
          seeker: {
            handle: seeker.handle,
            displayName: seeker.displayName,
            skills: cv?.parsedSkills || seeker.skills,
            yearsExp: cv?.yearsExp || 6,
            salaryMinZAR: cv?.salaryMinZAR || 85000,
            blindScreening: cv?.blindScreening ?? job.autonomyLevel === 'blind_screening_first',
            videoVerified: seeker.interviewVideo?.verification.verdict === 'VERIFIED_HUMAN',
          },
        }),
      });
      const data = await res.json();
      const matchId = `match_${job.id}_${seeker.id}`;
      const isBlind = Boolean(cv?.blindScreening || job.autonomyLevel === 'blind_screening_first');
      const newMatch: RecruitmentMatchDoc = {
        id: matchId,
        jobId: job.id,
        jobTitle: job.title,
        companyAgentHandle: job.companyAgentHandle,
        seekerHandle: seeker.handle,
        seekerName: isBlind ? `Candidate #${seeker.id.slice(-4).toUpperCase()} (Blind)` : seeker.displayName,
        recruiterHandle: 'alex.founder.agent',
        score: data.score || 88,
        factors: data.factors || {
          skillsOverlap: 90,
          experienceFit: 88,
          compensationFit: 86,
          locationCultureFit: 88,
        },
        explanation: data.explanation || 'Multi-signal Poppy recruitment match evaluated.',
        strengths: data.strengths || ['Strong domain skill alignment'],
        gaps: data.gaps || ['Minor onboarding adjustment'],
        blindMode: isBlind,
        status: 'suggested',
        updatedAt: new Date().toISOString(),
      };
      onUpsertMatch(newMatch);
      setExpandedMatchId(matchId);
    } finally {
      setMatchingBusyId(null);
    }
  };

  const triggerOperationsV3Gate = async (params: {
    actionType: PoppyOperation['actionType'];
    summary: string;
    targetHandle: string;
    actorHandle: string;
    terms: Record<string, string | number | boolean>;
    matchId?: string;
    nextStatus?: RecruitmentMatchDoc['status'];
  }) => {
    const res = await fetch('/api/poppy/operations/propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionType: params.actionType,
        summary: params.summary,
        targetHandle: params.targetHandle,
        actorHandle: params.actorHandle,
        terms: params.terms,
      }),
    });
    const data = await res.json();
    if (data.operation) {
      onProposeOperation(data.operation);
      if (params.matchId && params.nextStatus) {
        setPendingActionMatchUpdate({
          opId: data.operation.operation_id,
          matchId: params.matchId,
          nextStatus: params.nextStatus,
        });
      }
    }
  };

  const handleConfirmOperation = async (op: PoppyOperation, approver: 'user' | 'agent') => {
    setExecutingOpId(op.operation_id);
    setIdempotentBanner(null);
    try {
      const res = await fetch('/api/poppy/operations/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation_id: op.operation_id,
          revision: op.revision,
          approver,
          summary: op.summary,
          terms: op.terms,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.idempotentReplay) {
          setIdempotentBanner(
            `At-Most-Once Protection: ${op.operation_id} already executed (${data.reference}). Original receipt returned safely.`
          );
        } else {
          const matchUpdate =
            pendingActionMatchUpdate && pendingActionMatchUpdate.opId === op.operation_id
              ? { matchId: pendingActionMatchUpdate.matchId, nextStatus: pendingActionMatchUpdate.nextStatus }
              : undefined;
          onExecuteOperation(op.operation_id, approver, data.reference, matchUpdate);
          setPendingActionMatchUpdate(null);
        }
      }
    } finally {
      setExecutingOpId(null);
    }
  };

  const handleCreateJobSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const company = businesses.find((b) => b.handle === jobCompanyHandle) || businesses[0];
    const id = `job_${Date.now().toString().slice(-6)}`;
    onCreateJob({
      id,
      companyAgentHandle: jobCompanyHandle,
      companyName: company?.organization || jobCompanyHandle,
      title: jobTitle.trim() || 'AI Systems Engineer',
      location: 'Johannesburg / Hybrid',
      remoteMode: 'Hybrid',
      salaryRangeZAR: [Number(jobSalaryMin), Number(jobSalaryMax)],
      requiredSkills: jobSkillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      minYearsExp: 5,
      status: 'OPEN',
      autonomyLevel: jobAutonomy,
      careersUrl: company?.websiteUrl ? `https://${company.websiteUrl}/careers` : 'https://switchboard.agent/careers',
      poppyDiscoveryPath: `/jobs/${id}/.well-known/poppy.json`,
      weights: { skills: 45, experience: 25, compensation: 15, location: 15 },
      createdAt: new Date().toISOString(),
    });
    setNewJobOpen(false);
  };

  // Poppy Conversation Console helpers
  const buildExtensionsHeader = () =>
    Object.entries(enabledExtensions)
      .filter(([, on]) => on)
      .map(([name]) => {
        const ver = OFFICIAL_POPPY_EXTENSIONS.find((e) => e.name === name)?.version || 1;
        return `"${name}";v="${ver}"`;
      })
      .join(', ');

  const startPoppyConversation = async (parentId?: string) => {
    setConvBusy(true);
    try {
      const res = await fetch('/api/poppy/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Poppy-Version': '1.0',
          'Poppy-Extensions': buildExtensionsHeader(),
        },
        body: JSON.stringify({
          id: `req_${Date.now()}`,
          targetHandle: convTarget,
          initiatorHandle: selectedSeeker?.handle || 'chris.moleme.agent',
          parent_conversation_id: parentId,
          initialMessage: parentId
            ? undefined
            : `Opening Poppy v1.0 session with ${convTarget} under active scope grants.`,
        }),
      });
      const conv = await res.json();
      if (res.ok) setActiveConv(conv);
    } finally {
      setConvBusy(false);
    }
  };

  const sendPoppyMessage = async (opts?: { simulateUcp?: boolean; simulateBrowserHandoff?: boolean; action?: string }) => {
    if (!activeConv) return;
    setConvBusy(true);
    try {
      const res = await fetch(`/api/poppy/conversations/${activeConv.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Poppy-Version': '1.0',
          'Poppy-Extensions': buildExtensionsHeader(),
        },
        body: JSON.stringify({
          text: convMsg,
          author: {
            type: 'agent',
            name: selectedSeeker?.displayName || 'Personal Agent',
            handle: selectedSeeker?.handle || 'chris.moleme.agent',
          },
          simulateUcp: opts?.simulateUcp,
          simulateBrowserHandoff: opts?.simulateBrowserHandoff,
          proposeOperationAction: opts?.action,
        }),
      });
      const data = await res.json();
      if (data.conversation) {
        setActiveConv(data.conversation);
        const opExt = data.latestEvent?.extensions?.operations;
        if (opExt) {
          onProposeOperation({
            operation_id: opExt.operation_id,
            revision: opExt.revision,
            actionType: 'apply_job',
            summary: opExt.summary,
            terms: opExt.terms,
            expires_at: opExt.expires_at,
            status: 'pending',
            createdAt: new Date().toISOString(),
            targetHandle: activeConv.targetHandle,
            actorHandle: activeConv.initiatorHandle,
          });
        }
      }
    } finally {
      setConvBusy(false);
    }
  };

  const triggerConversationControl = async (action: 'handoff' | 'handoff/cancel' | 'close') => {
    if (!activeConv) return;
    const res = await fetch(`/api/poppy/conversations/${activeConv.id}/${action}`, { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.event) {
      setActiveConv((prev) =>
        prev ? { ...prev, status: data.status, events: [...prev.events, data.event] } : prev
      );
    }
  };

  const inspectTasksEndpoint = async () => {
    const res = await fetch('/api/poppy/tasks');
    const data = await res.json();
    setTasksData(JSON.stringify(data, null, 2));
  };

  const submitTaskFeedback = async () => {
    if (!feedbackComment.trim()) return;
    const res = await fetch('/api/poppy/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'excluded_task_inquiry', comment: feedbackComment }),
    });
    const data = await res.json();
    setFeedbackStatus(data.message || 'Feedback accepted');
    setFeedbackComment('');
  };

  const testBrowserSessionJoin = async () => {
    const authRes = await fetch('/api/poppy/browser-session/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: selectedSeeker?.handle || 'chris.moleme.agent', targetUrl: '/?tab=arena' }),
    });
    const authData = await authRes.json();
    const redeemRes = await fetch('/api/poppy/browser-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: authData.code }),
    });
    const redeemData = await redeemRes.json();
    setBrowserJoinInfo(`Code ${authData.code} -> Joined as ${redeemData.handle} (${redeemData.redirectUrl})`);
  };

  const inspectManifest = async (path: string) => {
    setManifestPath(path);
    setLoadingManifest(true);
    try {
      const res = await fetch(path);
      const data = await res.json();
      setManifestRaw(JSON.stringify(data, null, 2));
      if (path.includes('poppy.json')) {
        setValidationReport(validatePoppyDocument(data));
      } else {
        setValidationReport(null);
      }
    } catch {
      setManifestRaw('{"error": "Failed to fetch manifest"}');
      setValidationReport(null);
    } finally {
      setLoadingManifest(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Poppy + Autonomous Recruitment Header */}
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-cyan-400">
            Poppy v1.0 · <span className="text-emerald-300 tabular-nums">{pendingOperations.length} pending HITL</span>
          </p>
          <h2 className="text-base sm:text-lg font-semibold text-white mt-0.5">
            Poppy Hiring &amp; Protocol
          </h2>
        </div>

        <SwipeScrollArea
          direction="horizontal"
          innerClassName="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-950/75 border border-slate-800"
        >
          {(
            [
              { id: 'recruitment', label: 'Talent & Hiring', icon: Briefcase },
              { id: 'conversations', label: 'Poppy Chat', icon: MessageSquare },
              { id: 'consent_spec', label: 'Consent & Spec', icon: ShieldCheck },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection(tab.id)}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  section === tab.id
                    ? 'bg-cyan-400 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </SwipeScrollArea>
      </div>

      {/* Pending Operations v3 Approval Banner */}
      {(pendingOperations.length > 0 || idempotentBanner) && (
        <div className="rounded-2xl bg-amber-950/35 border border-amber-400/40 p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="text-xs font-semibold text-amber-200">
                Pending Approval (Operations v3)
              </span>
            </div>
            <span className="text-[11px] font-mono text-amber-300">At-most-once</span>
          </div>

          {idempotentBanner && (
            <div className="rounded-xl bg-emerald-950/60 border border-emerald-500/40 p-2.5 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{idempotentBanner}</span>
            </div>
          )}

          {pendingOperations.slice(0, 2).map((op) => (
            <div
              key={op.operation_id}
              className="rounded-xl bg-slate-950/85 border border-slate-800 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-semibold text-white">{op.summary}</p>
                <p className="text-[10px] font-mono text-slate-400 truncate">
                  op: {op.operation_id} · rev: {op.revision}
                </p>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-cyan-200">
                  {Object.entries(op.terms).map(([k, v]) => (
                    <span key={k} className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={executingOpId === op.operation_id}
                  onClick={() => handleConfirmOperation(op, 'user')}
                  className="min-h-[38px] rounded-lg bg-emerald-400 px-3 text-xs font-semibold text-slate-950 hover:bg-emerald-300 whitespace-nowrap"
                >
                  {executingOpId === op.operation_id ? 'Executing...' : 'Approve (User)'}
                </button>
                <button
                  type="button"
                  disabled={executingOpId === op.operation_id}
                  onClick={() => handleConfirmOperation(op, 'agent')}
                  className="min-h-[38px] rounded-lg bg-cyan-500/20 border border-cyan-400/40 px-2.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/30 whitespace-nowrap"
                >
                  Agent Guardrail
                </button>
                <button
                  type="button"
                  onClick={() => onDeclineOperation(op.operation_id)}
                  className="min-h-[38px] rounded-lg bg-rose-500/15 border border-rose-500/30 px-2.5 text-xs text-rose-300 hover:bg-rose-500/25 whitespace-nowrap"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SECTION 1: AUTONOMOUS RECRUITMENT OS */}
      {section === 'recruitment' && (
        <div className="space-y-3 sm:space-y-4">
          {/* 4-Role Swipeable Switcher */}
          <SwipeScrollArea direction="horizontal" innerClassName="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRoleTab('seeker')}
              className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                roleTab === 'seeker' ? 'bg-sky-400 text-slate-950' : 'glass-panel text-slate-300 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Job Seeker
            </button>
            <button
              type="button"
              onClick={() => setRoleTab('hiring')}
              className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                roleTab === 'hiring' ? 'bg-emerald-400 text-slate-950' : 'glass-panel text-slate-300 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Company Hiring
            </button>
            <button
              type="button"
              onClick={() => setRoleTab('recruiter')}
              className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                roleTab === 'recruiter' ? 'bg-violet-400 text-slate-950' : 'glass-panel text-slate-300 hover:text-white'
              }`}
            >
              <Handshake className="w-3.5 h-3.5" />
              Recruiter Agency
            </button>
            <button
              type="button"
              onClick={() => setRoleTab('video_live')}
              className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                roleTab === 'video_live' ? 'bg-cyan-400 text-slate-950' : 'glass-panel text-slate-300 hover:text-white'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              Video &amp; Live Call
            </button>
          </SwipeScrollArea>

          {roleTab === 'seeker' && selectedSeeker && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left: LinkedIn Wrapper + CV AI Parser */}
              <div className="lg:col-span-5 glass-panel rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white">Personal Talent Card</span>
                  <select
                    value={selectedSeeker.id}
                    onChange={(e) => {
                      const found = personas.find((p) => p.id === e.target.value);
                      setSelectedSeekerId(e.target.value);
                      if (found?.linkedinUrl) setLinkedinInput(found.linkedinUrl);
                    }}
                    className="rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1 text-xs text-cyan-200"
                  >
                    {personas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName} ({p.handle})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Compliant LinkedIn Reference Banner */}
                <div className="rounded-xl bg-sky-950/40 border border-sky-400/30 p-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-[#0A66C2] text-white font-bold text-[10px] inline-flex items-center justify-center shrink-0">
                      in
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">LinkedIn Wrapper</p>
                      <p className="text-[11px] font-mono text-cyan-300 truncate">
                        Zero Scraping · /u/{selectedSeeker.handle.replace('.agent', '')}/.well-known/poppy.json
                      </p>
                    </div>
                  </div>
                  <a
                    href={`/u/${selectedSeeker.handle.replace('.agent', '')}/.well-known/poppy.json`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-8 h-8 rounded-lg bg-slate-900/70 inline-flex items-center justify-center text-cyan-300 hover:text-white shrink-0"
                    title="Inspect user poppy.json"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                <div className="space-y-2.5">
                  <label className="block text-xs text-slate-300">
                    LinkedIn URL
                    <input
                      type="text"
                      value={linkedinInput}
                      onChange={(e) => setLinkedinInput(e.target.value)}
                      className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                    />
                  </label>
                  <label className="block text-xs text-slate-300">
                    CV Summary
                    <textarea
                      rows={3}
                      value={cvInputText}
                      onChange={(e) => setCvInputText(e.target.value)}
                      className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                    />
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleParseCv}
                      disabled={parsingCv}
                      className="min-h-[38px] rounded-xl bg-cyan-400 px-3.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {parsingCv ? 'Parsing...' : 'Parse Skills'}
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleBlindScreening}
                      className={`min-h-[38px] rounded-xl px-3 text-xs font-medium inline-flex items-center gap-1.5 border whitespace-nowrap ${
                        selectedSeeker.cvSummary?.blindScreening
                          ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}
                    >
                      {selectedSeeker.cvSummary?.blindScreening ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      {selectedSeeker.cvSummary?.blindScreening ? 'Blind ON' : 'Blind OFF'}
                    </button>
                  </div>
                </div>

                {/* Structured Skills Graph */}
                {selectedSeeker.cvSummary && (
                  <div className="rounded-xl bg-slate-950/75 border border-slate-800 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white truncate">
                        {selectedSeeker.cvSummary.headline}
                      </span>
                      <span className="font-mono text-emerald-300 shrink-0">
                        {selectedSeeker.cvSummary.yearsExp} yrs
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSeeker.cvSummary.parsedSkills.map((sk) => (
                        <span
                          key={sk}
                          className="rounded-md bg-slate-900 border border-slate-700 px-2 py-0.5 text-[10px] text-cyan-200"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] font-mono text-slate-400">
                      Min Salary: {formatMoney(selectedSeeker.cvSummary.salaryMinZAR || 85000, currency)}/mo
                    </p>
                  </div>
                )}

                {/* Candidate Interview Video & Anti-Deepfake Quick Action */}
                <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                      {selectedSeeker.interviewVideo
                        ? selectedSeeker.interviewVideo.verification.verdict === 'VERIFIED_HUMAN'
                          ? `Verified Real (${selectedSeeker.interviewVideo.verification.authenticityScore}%)`
                          : 'Flagged Synthetic Risk'
                        : 'No Interview Video'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {selectedSeeker.interviewVideo
                        ? `${selectedSeeker.interviewVideo.preScreenReviews.length} pre-screen(s)`
                        : 'Upload or record webcam clip'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRoleTab('video_live')}
                    className="min-h-[36px] rounded-lg bg-cyan-500/20 border border-cyan-400/40 px-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/30 shrink-0 whitespace-nowrap"
                  >
                    Video Studio
                  </button>
                </div>
              </div>

              {/* Right: Matched Jobs + Explainable Scoring + Operations v3 Apply */}
              <div className="lg:col-span-7 space-y-3">
                {jobs.map((job) => {
                  const match = matches.find(
                    (m) => m.jobId === job.id && m.seekerHandle === selectedSeeker.handle
                  );
                  return (
                    <div key={job.id} className="glass-panel rounded-2xl p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-cyan-300">{job.companyAgentHandle}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                              {job.remoteMode}
                            </span>
                          </div>
                          <h3 className="text-sm sm:text-base font-semibold text-white mt-0.5">{job.title}</h3>
                          <p className="text-xs text-slate-400">
                            {job.companyName} · {formatMoney(job.salaryRangeZAR[0], currency)}–{formatMoney(job.salaryRangeZAR[1], currency)}/mo
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {match && (
                            <span className="font-mono text-xs sm:text-sm font-bold text-emerald-300 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/30 tabular-nums">
                              {match.score}% fit
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={matchingBusyId === job.id}
                            onClick={() => handleRunMatchForJob(job, selectedSeeker)}
                            className="min-h-[38px] rounded-lg bg-slate-900 border border-slate-700 px-3 text-xs text-slate-200 hover:border-cyan-400 inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <RefreshCw className={`w-3 h-3 ${matchingBusyId === job.id ? 'animate-spin' : ''}`} />
                            Score Fit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              triggerOperationsV3Gate({
                                actionType: 'apply_job',
                                summary: `Apply as ${selectedSeeker.handle} -> ${job.title} (${job.companyName})`,
                                targetHandle: job.companyAgentHandle,
                                actorHandle: selectedSeeker.handle,
                                matchId: match?.id,
                                nextStatus: 'applied',
                                terms: {
                                  jobId: job.id,
                                  candidateHandle: selectedSeeker.handle,
                                  blindScreening: Boolean(selectedSeeker.cvSummary?.blindScreening),
                                  salaryBandZAR: `${job.salaryRangeZAR[0]}-${job.salaryRangeZAR[1]}`,
                                },
                              })
                            }
                            className="min-h-[38px] rounded-lg bg-cyan-400 px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-300 whitespace-nowrap"
                          >
                            Apply
                          </button>
                        </div>
                      </div>

                      {match && (
                        <div className="rounded-xl bg-slate-950/75 border border-slate-800 p-3 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-cyan-200">Why this match?</span>
                            <span className="font-mono text-[10px] uppercase text-emerald-300">
                              Stage: {match.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300">{match.explanation}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
                            <div className="bg-slate-900 rounded-lg p-2">
                              <span className="text-slate-400 block">Skills</span>
                              <span className="text-emerald-300 font-semibold">{match.factors.skillsOverlap}%</span>
                            </div>
                            <div className="bg-slate-900 rounded-lg p-2">
                              <span className="text-slate-400 block">Experience</span>
                              <span className="text-cyan-300 font-semibold">{match.factors.experienceFit}%</span>
                            </div>
                            <div className="bg-slate-900 rounded-lg p-2">
                              <span className="text-slate-400 block">Comp Fit</span>
                              <span className="text-amber-300 font-semibold">{match.factors.compensationFit}%</span>
                            </div>
                            <div className="bg-slate-900 rounded-lg p-2">
                              <span className="text-slate-400 block">Location</span>
                              <span className="text-sky-300 font-semibold">{match.factors.locationCultureFit}%</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {roleTab === 'hiring' && (
            <div className="space-y-4">
              <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-white">Company Hiring Pipeline</h3>
                  <p className="text-xs text-slate-400 font-mono truncate">
                    /jobs/:id/.well-known/poppy.json · Operations v3
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewJobOpen((v) => !v)}
                  className="min-h-[38px] rounded-xl bg-emerald-400 px-3.5 text-xs font-semibold text-slate-950 hover:bg-emerald-300 inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Hiring Role
                </button>
              </div>

              {newJobOpen && (
                <form onSubmit={handleCreateJobSubmit} className="glass-panel rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs text-slate-300">
                    Company Agent
                    <select
                      value={jobCompanyHandle}
                      onChange={(e) => setJobCompanyHandle(e.target.value)}
                      className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                    >
                      {businesses.map((b) => (
                        <option key={b.id} value={b.handle}>
                          {b.organization} ({b.handle})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-slate-300">
                    Role Title
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                      required
                    />
                  </label>
                  <label className="text-xs text-slate-300">
                    Required Skills (comma-separated)
                    <input
                      type="text"
                      value={jobSkillsText}
                      onChange={(e) => setJobSkillsText(e.target.value)}
                      className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                    />
                  </label>
                  <label className="text-xs text-slate-300">
                    Autonomy & Blind Screening Policy
                    <select
                      value={jobAutonomy}
                      onChange={(e) => setJobAutonomy(e.target.value as JobPostingDoc['autonomyLevel'])}
                      className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                    >
                      <option value="approve_each">Approve Each Step (Strict HITL)</option>
                      <option value="shortlist_auto_offer_approve">Auto-Shortlist, Approve Offers</option>
                      <option value="blind_screening_first">Blind Screening First (Anonymized)</option>
                    </select>
                  </label>
                  <label className="text-xs text-slate-300">
                    Min Salary (ZAR/mo)
                    <input
                      type="number"
                      value={jobSalaryMin}
                      onChange={(e) => setJobSalaryMin(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                    />
                  </label>
                  <label className="text-xs text-slate-300">
                    Max Salary (ZAR/mo)
                    <input
                      type="number"
                      value={jobSalaryMax}
                      onChange={(e) => setJobSalaryMax(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                    />
                  </label>
                  <div className="sm:col-span-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setNewJobOpen(false)}
                      className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300"
                    >
                      Publish Hiring Agent
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matches.map((m) => {
                  const candidateAgent = agents.find((a) => a.handle === m.seekerHandle);
                  const linkedJob = jobs.find((j) => j.id === m.jobId);
                  const videoVer = candidateAgent?.interviewVideo?.verification;
                  const reviewCount = candidateAgent?.interviewVideo?.preScreenReviews.length || 0;
                  return (
                    <div key={m.id} className="glass-panel rounded-2xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-mono text-cyan-300">
                            {m.blindMode ? 'BLIND_CANDIDATE_TOKEN' : m.seekerHandle}
                          </p>
                          <h4 className="text-sm font-semibold text-white">{m.seekerName}</h4>
                          <p className="text-xs text-slate-400">{m.jobTitle}</p>
                        </div>
                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                          {m.score}%
                        </span>
                      </div>

                      {videoVer && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950/75 border border-slate-800 px-3 py-1.5 text-[11px]">
                          <span
                            className={`font-mono font-semibold inline-flex items-center gap-1 ${
                              videoVer.verdict === 'VERIFIED_HUMAN' ? 'text-emerald-300' : 'text-rose-300'
                            }`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {videoVer.verdict === 'VERIFIED_HUMAN'
                              ? `Video Real (${videoVer.authenticityScore}%)`
                              : `Deepfake Risk (${videoVer.deepfakeRiskPct}%)`}
                          </span>
                          <span className="text-slate-400 font-mono">{reviewCount} pre-screens</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedMatchId(expandedMatchId === m.id ? null : m.id)}
                        className="text-[11px] text-cyan-300 hover:underline"
                      >
                        {expandedMatchId === m.id ? 'Hide explanation' : 'Why this match? (Factor Breakdown)'}
                      </button>

                      {expandedMatchId === m.id && (
                        <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 space-y-1.5 text-xs">
                          <p className="text-slate-300">{m.explanation}</p>
                          <p className="text-[11px] text-emerald-300">Strengths: {m.strengths.join(' · ')}</p>
                          <p className="text-[11px] text-amber-300">Gaps: {m.gaps.join(' · ')}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                        <span className="text-[11px] font-mono uppercase text-slate-300">
                          Stage: <span className="text-cyan-300">{m.status}</span>
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {candidateAgent && (
                            <button
                              type="button"
                              onClick={() =>
                                setLiveRoomState({
                                  open: true,
                                  candidate: candidateAgent,
                                  job: linkedJob || null,
                                  booking:
                                    bookings.find(
                                      (b) =>
                                        b.attendeeHandle === candidateAgent.handle ||
                                        b.organizerHandle === candidateAgent.handle
                                    ) || null,
                                  interviewerHandle: m.companyAgentHandle,
                                  interviewerName: linkedJob?.companyName || m.companyAgentHandle,
                                })
                              }
                              className="rounded-lg bg-cyan-500/20 border border-cyan-400/30 px-2.5 py-1 text-[11px] text-cyan-200 hover:bg-cyan-500/30 inline-flex items-center gap-1"
                            >
                              <Video className="w-3 h-3" />
                              Live Call
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              triggerOperationsV3Gate({
                                actionType: 'shortlist_candidate',
                                summary: `Shortlist ${m.seekerName} -> ${m.jobTitle}`,
                                targetHandle: m.companyAgentHandle,
                                actorHandle: m.seekerHandle,
                                matchId: m.id,
                                nextStatus: 'shortlisted',
                                terms: {
                                  matchId: m.id,
                                  blindReveal: m.blindMode,
                                  score: m.score,
                                },
                              })
                            }
                            className="rounded-lg bg-sky-500/20 border border-sky-400/30 px-2.5 py-1 text-[11px] text-sky-200 hover:bg-sky-500/30"
                          >
                            Shortlist (Op v3)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              triggerOperationsV3Gate({
                                actionType: 'book_interview',
                                summary: `Schedule Interview: ${m.seekerName} with ${m.companyAgentHandle}`,
                                targetHandle: m.companyAgentHandle,
                                actorHandle: m.seekerHandle,
                                matchId: m.id,
                                nextStatus: 'interview',
                                terms: {
                                  matchId: m.id,
                                  calendarScope: 'calendar',
                                  slotSAST: 'Tomorrow 10:00 SAST',
                                },
                              })
                            }
                            className="rounded-lg bg-emerald-400 px-2.5 py-1 text-[11px] font-semibold text-slate-950 hover:bg-emerald-300"
                          >
                            Interview (Op v3)
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {roleTab === 'recruiter' && (
            <div className="glass-panel rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-white">Recruiter Mediation</h3>
                  <p className="text-xs text-slate-400">
                    Client roles · 12% x402 success fee
                  </p>
                </div>
                <span className="font-mono text-xs text-violet-300 bg-violet-500/15 border border-violet-400/30 px-3 py-1.5 rounded-xl whitespace-nowrap">
                  12% Escrowed
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {jobs.map((job) => {
                  const estAnnualZAR = job.salaryRangeZAR[1] * 12;
                  const estFeeZAR = Math.round(estAnnualZAR * 0.12);
                  return (
                    <div key={job.id} className="rounded-xl bg-slate-950/75 border border-slate-800 p-3.5 space-y-2">
                      <p className="text-[11px] font-mono text-violet-300">{job.companyName}</p>
                      <p className="text-xs sm:text-sm font-semibold text-white">{job.title}</p>
                      <p className="text-xs text-slate-400">
                        Est. Fee: <span className="font-mono text-emerald-300 tabular-nums">{formatMoney(estFeeZAR, currency)}</span>
                      </p>
                      <div className="flex items-center justify-between pt-2 gap-2">
                        <a
                          href={job.poppyDiscoveryPath}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-mono text-cyan-300 hover:underline truncate max-w-[160px]"
                        >
                          {job.poppyDiscoveryPath}
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setConvTarget(job.companyAgentHandle);
                            setSection('conversations');
                          }}
                          className="min-h-[34px] rounded-lg bg-violet-400 px-3 text-xs font-semibold text-slate-950 whitespace-nowrap"
                        >
                          Mediate
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {roleTab === 'video_live' && selectedSeeker && (
            <div className="space-y-4">
              <div className="glass-panel rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-white">
                    Video &amp; Live Interview Studio
                  </h3>
                  <p className="text-xs text-slate-400">
                    Liveness scan, HR pre-screening &amp; calendar calls
                  </p>
                </div>
                <select
                  value={selectedSeeker.id}
                  onChange={(e) => {
                    const found = personas.find((p) => p.id === e.target.value);
                    setSelectedSeekerId(e.target.value);
                    if (found?.linkedinUrl) setLinkedinInput(found.linkedinUrl);
                  }}
                  className="rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-2 text-xs text-cyan-200"
                >
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName} ({p.handle})
                    </option>
                  ))}
                </select>
              </div>

              <VideoInterviewStudioPanel
                candidate={selectedSeeker}
                allAgents={agents}
                jobs={jobs}
                bookings={bookings}
                workspaceToken={workspaceToken}
                ownerUid={ownerUid}
                onSaveVideo={onSaveVideo}
                onAddPreScreenReview={onAddPreScreenReview}
                onAddBooking={onAddBooking}
                onConnectGoogle={onConnectGoogle}
                onLaunchLiveRoom={(params) =>
                  setLiveRoomState({
                    open: true,
                    candidate: params.candidate,
                    job: params.job || null,
                    booking: params.booking || null,
                    interviewerHandle: params.interviewerHandle,
                    interviewerName: params.interviewerName,
                  })
                }
              />
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: POPPY PROTOCOL CONVERSATIONS & EXTENSIONS */}
      {section === 'conversations' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left: Protocol Headers & Extensions Controls */}
          <div className="lg:col-span-4 glass-panel rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Poppy Headers &amp; Extensions</h3>
            <label className="block text-xs text-slate-300">
              Target Agent
              <select
                value={convTarget}
                onChange={(e) => setConvTarget(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
              >
                {agents
                  .filter((a) => a.handle !== '911.emergency.agent')
                  .map((a) => (
                    <option key={a.id} value={a.handle}>
                      {a.displayName} ({a.handle})
                    </option>
                  ))}
              </select>
            </label>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-300">Negotiated Extensions</p>
              {OFFICIAL_POPPY_EXTENSIONS.map((ext) => (
                <label
                  key={ext.name}
                  className="flex items-start justify-between gap-2 rounded-xl bg-slate-950/75 border border-slate-800 p-2.5 cursor-pointer"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-cyan-300">
                      {ext.name} <span className="text-slate-500">v{ext.version}</span>
                    </span>
                    <p className="text-[11px] text-slate-400 leading-snug mt-0.5 line-clamp-2">{ext.summary}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(enabledExtensions[ext.name])}
                    onChange={() =>
                      setEnabledExtensions((prev) => ({ ...prev, [ext.name]: !prev[ext.name] }))
                    }
                    className="mt-1 accent-cyan-400"
                  />
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={convBusy}
                onClick={() => startPoppyConversation()}
                className="flex-1 min-h-[36px] rounded-xl bg-cyan-400 px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-300"
              >
                Start Conversation
              </button>
              <button
                type="button"
                onClick={testBrowserSessionJoin}
                className="min-h-[36px] rounded-xl bg-slate-900 border border-slate-700 px-3 text-xs text-slate-200 hover:border-cyan-400"
              >
                Browser Join (§6)
              </button>
            </div>
            {browserJoinInfo && (
              <p className="text-[10px] font-mono text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-2">
                {browserJoinInfo}
              </p>
            )}
          </div>

          {/* Right: Live Conversation Stream + Task Coverage */}
          <div className="lg:col-span-8 space-y-4">
            <div className="glass-panel rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <div className="min-w-0">
                  <span className="text-xs font-mono text-cyan-300">
                    {activeConv ? activeConv.id : 'No active conversation'}
                  </span>
                  {activeConv && (
                    <p className="text-[11px] text-slate-400">
                      Status: <span className="text-emerald-300 font-mono">{activeConv.status}</span> · Browser Control:{' '}
                      <span className="text-amber-300 font-mono">{activeConv.browserController}</span>
                    </p>
                  )}
                </div>

                {activeConv && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => triggerConversationControl('handoff')}
                      className="rounded-lg bg-amber-500/20 border border-amber-400/30 px-2.5 py-1 text-[11px] text-amber-200"
                    >
                      Handoff
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerConversationControl('handoff/cancel')}
                      className="rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300"
                    >
                      Cancel Handoff
                    </button>
                    <button
                      type="button"
                      onClick={() => startPoppyConversation(activeConv.id)}
                      className="rounded-lg bg-sky-500/20 border border-sky-400/30 px-2.5 py-1 text-[11px] text-sky-200"
                    >
                      Direct Conv
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerConversationControl('close')}
                      className="rounded-lg bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 text-[11px] text-rose-300"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>

              <SwipeScrollArea direction="vertical" className="max-h-[300px]" innerClassName="space-y-2.5">
                {!activeConv ? (
                  <p className="text-xs text-slate-400 py-8 text-center">
                    Tap &quot;Start Conversation&quot; to open a Poppy v1.0 session.
                  </p>
                ) : (
                  activeConv.events.map((evt) => (
                    <div key={evt.id} className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className={evt.author.type === 'human' ? 'text-amber-300' : 'text-cyan-300'}>
                          [{evt.author.type.toUpperCase()}] {evt.author.name}
                        </span>
                        <span className="text-slate-500">cursor #{evt.cursor}</span>
                      </div>
                      <p className="text-xs text-slate-200">{evt.text}</p>

                      {/* Disclosures v1 Extension Rendering */}
                      {evt.extensions?.disclosures?.items.map((disc) => (
                        <div
                          key={disc.id}
                          className="rounded-lg bg-amber-950/40 border border-amber-400/30 px-2.5 py-1.5 text-[11px] text-amber-200 flex items-start gap-1.5"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>
                            <strong>{disc.category}:</strong> {disc.text}
                          </span>
                        </div>
                      ))}

                      {/* Links v1 Extension Rendering */}
                      {evt.extensions?.links?.items && (
                        <div className="flex flex-wrap gap-1.5">
                          {evt.extensions.links.items.map((lnk) => (
                            <a
                              key={lnk.url}
                              href={lnk.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-[10px] text-cyan-300 hover:border-cyan-400"
                            >
                              <LinkIcon className="w-3 h-3" />
                              {lnk.title}
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Browser Control, UCP & Mediated Sign-In Badges */}
                      <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                        {evt.extensions?.['browser-control'] && (
                          <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-200 border border-sky-400/30">
                            browser-control: {evt.extensions['browser-control'].controller} ({evt.extensions['browser-control'].step})
                          </span>
                        )}
                        {evt.extensions?.ucp && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-200 border border-emerald-400/30">
                            ucp: {evt.extensions.ucp.cart_ref}
                          </span>
                        )}
                        {evt.extensions?.['mediated-sign-in'] && (
                          <span className="px-2 py-0.5 rounded bg-violet-500/15 text-violet-200 border border-violet-400/30">
                            mediated-sign-in: {evt.extensions['mediated-sign-in'].status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </SwipeScrollArea>

              {activeConv && activeConv.status !== 'closed' && (
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <input
                    type="text"
                    value={convMsg}
                    onChange={(e) => setConvMsg(e.target.value)}
                    className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                    placeholder="Send message over Poppy Conversations v1.0..."
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={convBusy}
                      onClick={() => sendPoppyMessage()}
                      className="min-h-[36px] rounded-xl bg-cyan-400 px-3.5 text-xs font-semibold text-slate-950 inline-flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send
                    </button>
                    <button
                      type="button"
                      disabled={convBusy}
                      onClick={() => sendPoppyMessage({ simulateUcp: true, action: 'settle_fee' })}
                      className="min-h-[36px] rounded-xl bg-emerald-500/20 border border-emerald-400/40 px-2.5 text-xs text-emerald-200"
                    >
                      +Op v3 & UCP
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Task Coverage & Feedback (§9) */}
            <div className="glass-panel rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white">Task Coverage &amp; Feedback (§9)</span>
                <button
                  type="button"
                  onClick={inspectTasksEndpoint}
                  className="min-h-[34px] rounded-lg bg-slate-900 border border-slate-700 px-2.5 text-xs text-cyan-300 hover:border-cyan-400 whitespace-nowrap"
                >
                  Fetch Tasks
                </button>
              </div>
              {tasksData && (
                <SwipeScrollArea direction="both" className="rounded-xl bg-slate-950 border border-slate-800 max-h-[160px]">
                  <pre className="p-3 text-[11px] font-mono text-emerald-300 whitespace-pre">
                    {tasksData}
                  </pre>
                </SwipeScrollArea>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Request missing capability..."
                  className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={submitTaskFeedback}
                  className="min-h-[38px] rounded-xl bg-slate-800 hover:bg-slate-700 px-3 text-xs text-white whitespace-nowrap"
                >
                  Send
                </button>
              </div>
              {feedbackStatus && <p className="text-[11px] text-emerald-300">{feedbackStatus}</p>}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: CONSENT GOVERNANCE, SCOPES & SPEC VALIDATOR */}
      {section === 'consent_spec' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left: Granular Scopes + Instant Revocation + Compliance Trail */}
          <div className="lg:col-span-6 space-y-4">
            <div className="glass-panel rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-white">Consent &amp; Scope</h3>
                  <p className="text-xs text-slate-400">
                    Poppy scopes &amp; POPIA §11 revocation
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onRevokeAllConsents}
                  className="min-h-[36px] rounded-xl bg-rose-500/20 border border-rose-400/40 px-3 text-xs font-semibold text-rose-200 hover:bg-rose-500/30 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Revoke All
                </button>
              </div>

              <div className="space-y-2">
                {poppyConsents.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-cyan-300">{c.scope}</span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            c.changes === 'irreversible'
                              ? 'bg-rose-500/15 text-rose-300'
                              : 'bg-emerald-500/15 text-emerald-300'
                          }`}
                        >
                          {c.changes}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{c.summary}</p>
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">
                        {c.agentHandle} → {c.targetHandle}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleConsentScope(c.id)}
                      className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold shrink-0 whitespace-nowrap ${
                        c.granted
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {c.granted ? 'Granted' : 'Revoked'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 space-y-2.5">
              <h4 className="text-xs sm:text-sm font-semibold text-white">Compliance Audit Log</h4>
              <SwipeScrollArea direction="vertical" className="max-h-[220px]" innerClassName="space-y-2">
                {poppyAuditLogs.map((log) => (
                  <div key={log.id} className="rounded-lg bg-slate-950/70 border border-slate-800 p-2.5 text-xs">
                    <div className="flex items-center justify-between font-mono text-[11px] text-cyan-300">
                      <span>{log.action}</span>
                      <span className="text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-300 mt-0.5 line-clamp-2">{log.details}</p>
                  </div>
                ))}
              </SwipeScrollArea>
            </div>
          </div>

          {/* Right: Live Poppy Spec Validator & RFC Endpoints */}
          <div className="lg:col-span-6 glass-panel rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-cyan-300" />
                Live `poppy.json` Validator
              </h3>
              <Globe className="w-4 h-4 text-slate-400" />
            </div>

            <SwipeScrollArea direction="horizontal" innerClassName="flex items-center gap-1.5">
              {[
                '/.well-known/poppy.json',
                '/u/chris.moleme/.well-known/poppy.json',
                '/companies/ceo.woolworths/.well-known/poppy.json',
                '/jobs/job_woolies_growth_01/.well-known/poppy.json',
                '/.well-known/oauth-protected-resource',
                '/.well-known/oauth-authorization-server',
                '/agent.json',
                '/jwks.json',
                '/.well-known/agent-skills/index.json',
              ].map((ep) => (
                <button
                  key={ep}
                  type="button"
                  onClick={() => inspectManifest(ep)}
                  className={`min-h-[36px] rounded-lg px-2.5 py-1 text-[10.5px] font-mono border whitespace-nowrap shrink-0 ${
                    manifestPath === ep
                      ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {ep}
                </button>
              ))}
            </SwipeScrollArea>

            {validationReport && (
              <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Poppy v1.0 Spec Validation</span>
                  <span
                    className={`font-mono font-bold tabular-nums ${
                      validationReport.valid ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {validationReport.score}% ({validationReport.valid ? 'VALID' : 'INCOMPLETE'})
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10.5px]">
                  {validationReport.checks.map((chk) => (
                    <div key={chk.field} className="flex items-start gap-1.5 text-slate-300">
                      {chk.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <span className="truncate">
                        <strong className="text-white">{chk.field}:</strong> {chk.detail}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <SwipeScrollArea direction="both" className="rounded-xl bg-slate-950 border border-slate-800 max-h-[280px]">
              <pre className="p-3 text-[11px] font-mono text-emerald-300 whitespace-pre">
                {loadingManifest
                  ? 'Fetching live endpoint...'
                  : manifestRaw || 'Select any Poppy or OAuth discovery endpoint above to inspect & validate.'}
              </pre>
            </SwipeScrollArea>
          </div>
        </div>
      )}

      <LiveInterviewRoomModal
        open={liveRoomState.open}
        onClose={() => setLiveRoomState((prev) => ({ ...prev, open: false }))}
        candidate={liveRoomState.candidate}
        interviewerHandle={liveRoomState.interviewerHandle}
        interviewerName={liveRoomState.interviewerName}
        job={liveRoomState.job}
        booking={liveRoomState.booking}
        onSubmitReview={(agentId, review) => onAddPreScreenReview(agentId, review)}
      />
    </div>
  );
};
