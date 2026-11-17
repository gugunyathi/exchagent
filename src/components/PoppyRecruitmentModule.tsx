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
  FileCheck2,
  Plus,
  Handshake,
  Link as LinkIcon,
  ShieldAlert,
  Video,
  ChevronDown,
  ChevronUp,
  X,
  Sliders,
  ArrowLeft,
  CalendarPlus,
  Linkedin,
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
import { emitToast } from '../lib/toast';

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
  onOpenQuickJobAgent?: () => void;
  onOpenQuickEmployerAgent?: () => void;
}

type PrimaryHiringTab = 'matches' | 'studio' | 'consent';
type RoleFilter = 'seeker' | 'hiring' | 'recruiter';
type ProtocolDrawerTab = 'conversations' | 'validator' | 'tasks';

const FitScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 44 }) => {
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  const strokeColor =
    clamped >= 85 ? '#10b981' : clamped >= 70 ? '#0284c7' : '#d97706';

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      title={`${clamped}% Fit Score`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-zinc-200 dark:text-white/10"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-[11px] font-mono font-semibold tabular-nums text-zinc-950 dark:text-zinc-100">
        {clamped}%
      </span>
    </div>
  );
};

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
  onOpenQuickJobAgent,
  onOpenQuickEmployerAgent,
}) => {
  const [activeTab, setActiveTab] = useState<PrimaryHiringTab>(
    initialRoleTab === 'video_live' ? 'studio' : 'matches'
  );
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(
    initialRoleTab === 'hiring' || initialRoleTab === 'recruiter' ? initialRoleTab : 'seeker'
  );

  // Slide-over Protocol & poppy.json Inspector Drawer
  const [protocolDrawerOpen, setProtocolDrawerOpen] = useState(false);
  const [protocolDrawerTab, setProtocolDrawerTab] = useState<ProtocolDrawerTab>('conversations');

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

  const personas = agents.filter((a) => a.type === 'persona');
  const businesses = agents.filter((a) => a.type === 'business' && a.handle !== '911.emergency.agent');
  const [selectedSeekerId, setSelectedSeekerId] = useState<string>(initialSeekerId || personas[0]?.id || '');
  const selectedSeeker = personas.find((p) => p.id === selectedSeekerId) || personas[0];

  useEffect(() => {
    if (initialRoleTab === 'video_live') {
      setActiveTab('studio');
    } else if (initialRoleTab) {
      setActiveTab('matches');
      setRoleFilter(initialRoleTab);
    }
    if (initialSeekerId) {
      setSelectedSeekerId(initialSeekerId);
    }
  }, [initialRoleTab, initialSeekerId]);

  // Collapsible CV & LinkedIn Editor
  const [cvDrawerOpen, setCvDrawerOpen] = useState(false);
  const [cvInputText, setCvInputText] = useState<string>(
    '8+ years leading Full Stack B2B Growth, Marketing Automation, HubSpot CRM, SQL revenue attribution, and AI outbound pipelines in Johannesburg. Seeking R85,000+ / mo hybrid or remote.'
  );
  const [linkedinInput, setLinkedinInput] = useState<string>(
    selectedSeeker?.linkedinUrl || 'linkedin.com/in/chrismoleme'
  );
  const [parsingCv, setParsingCv] = useState(false);

  // Hiring Job Composer
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
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Pending Operations v3 Queue
  const [pendingActionMatchUpdate, setPendingActionMatchUpdate] = useState<{
    opId: string;
    matchId: string;
    nextStatus: RecruitmentMatchDoc['status'];
  } | null>(null);
  const [executingOpId, setExecutingOpId] = useState<string | null>(null);

  // Poppy Conversation & Extensions Console (inside Inspector Drawer)
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
  const [browserJoinInfo, setBrowserJoinInfo] = useState<string | null>(null);

  // Spec Validator (inside Inspector Drawer)
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
        emitToast(`Extracted ${data.parsedSkills.length} verified skills`, 'success');
        setCvDrawerOpen(false);
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
    const next = !current.blindScreening;
    onUpdateSeekerCv(selectedSeeker.id, {
      ...current,
      blindScreening: next,
    });
    emitToast(next ? 'Blind screening enabled' : 'Blind screening disabled', 'info');
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
      emitToast(`Scored ${newMatch.score}% fit for ${job.title}`, 'success');
    } finally {
      setMatchingBusyId(null);
    }
  };

  const handleBookInterviewForJob = async (
    job: JobPostingDoc,
    seeker: AgentDoc,
    match?: RecruitmentMatchDoc,
    slotOffsetHours = 24
  ) => {
    const start = new Date(Date.now() + slotOffsetHours * 60 * 60 * 1000);
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const bookingId = `book_poppy_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

    await onAddBooking({
      id: bookingId,
      organizerAgentId: seeker.id,
      organizerHandle: seeker.handle,
      attendeeAgentId: job.companyAgentHandle,
      attendeeHandle: job.companyAgentHandle,
      ownerUid,
      title: `Screening Interview: ${job.title}`,
      jobId: job.id,
      jobTitle: job.title,
      interviewMode: 'live_video',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      meetLink: `switchboard://live-interview/${bookingId}`,
      dealValueZAR: job.salaryRangeZAR?.[0] || 85000,
      googleSynced: false,
      status: 'CONFIRMED',
    });

    if (match) {
      onUpsertMatch({
        ...match,
        status: 'interview',
        updatedAt: new Date().toISOString(),
      });
    } else {
      onUpsertMatch({
        id: `match_${job.id}_${seeker.id}`,
        jobId: job.id,
        jobTitle: job.title,
        companyAgentHandle: job.companyAgentHandle,
        seekerHandle: seeker.handle,
        seekerName: seeker.displayName,
        score: 86,
        factors: {
          skillsOverlap: 86,
          experienceFit: 86,
          compensationFit: 88,
          locationCultureFit: 88,
        },
        explanation: `Interview slot requested directly via ${seeker.handle}.`,
        strengths: seeker.skills.slice(0, 2),
        gaps: ['Team walkthrough'],
        blindMode: Boolean(seeker.cvSummary?.blindScreening),
        status: 'interview',
        updatedAt: new Date().toISOString(),
      });
    }

    fetch('/api/agentmail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inbox: seeker.agentEmail,
        to: 'exchagent@agentmail.to',
        subject: `Interview Confirmed (${match?.score || 86}% Fit): ${seeker.displayName} for ${job.title}`,
        text:
          match?.interviewPitch ||
          `Hello ${job.companyName} Hiring Agent — requesting a screening interview for ${seeker.displayName} (${seeker.linkedinUrl || seeker.handle}) for ${job.title}.`,
      }),
    }).catch(() => {});

    emitToast(`Interview booked for ${job.title}`, 'success');
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
      emitToast('Approval queued (Operations v3)', 'info');
    }
  };

  const handleConfirmOperation = async (op: PoppyOperation, approver: 'user' | 'agent') => {
    setExecutingOpId(op.operation_id);
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
          emitToast(`Idempotent replay guarded (${data.reference})`, 'warning');
        } else {
          const matchUpdate =
            pendingActionMatchUpdate && pendingActionMatchUpdate.opId === op.operation_id
              ? { matchId: pendingActionMatchUpdate.matchId, nextStatus: pendingActionMatchUpdate.nextStatus }
              : undefined;
          onExecuteOperation(op.operation_id, approver, data.reference, matchUpdate);
          setPendingActionMatchUpdate(null);
          emitToast(`Executed (${approver}): ${data.reference}`, 'success');
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
    emitToast('Hiring role published', 'success');
  };

  // Poppy Conversation helpers
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
      if (res.ok) {
        setActiveConv(conv);
        emitToast(`Poppy session opened with ${convTarget}`, 'success');
      }
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
          emitToast('Operation v3 proposed in thread', 'info');
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
      emitToast(`Conversation ${action} complete`, 'info');
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
    setFeedbackComment('');
    emitToast(data.message || 'Feedback accepted', 'success');
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
    setBrowserJoinInfo(`${authData.code} -> ${redeemData.handle} (${redeemData.redirectUrl})`);
    emitToast('Browser session joined (§6)', 'success');
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

  useEffect(() => {
    if (!protocolDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProtocolDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [protocolDrawerOpen]);

  return (
    <div className="space-y-4">
      {/* Segmented Header */}
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-display font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
              Autonomous Hiring
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Poppy v1.0 matching, forensic video screening &amp; POPIA consent
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SwipeScrollArea
            direction="horizontal"
            innerClassName="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10"
          >
            {(
              [
                { id: 'matches', label: 'Matches & Roles', icon: Briefcase },
                { id: 'studio', label: 'Video & Live Studio', icon: Video },
                { id: 'consent', label: 'Consent & Spec', icon: ShieldCheck },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[36px] px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold shadow-2xs'
                      : 'text-zinc-700 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.id === 'consent' && pendingOperations.length > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums leading-none ${
                        active
                          ? 'bg-white text-zinc-950 dark:bg-zinc-950 dark:text-amber-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-300'
                      }`}
                    >
                      {pendingOperations.length}
                    </span>
                  )}
                </button>
              );
            })}
          </SwipeScrollArea>

          {onOpenQuickJobAgent && (
            <button
              type="button"
              onClick={onOpenQuickJobAgent}
              className="min-h-[38px] px-3 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Linkedin className="w-3.5 h-3.5" />
              1-Click Job Agent
            </button>
          )}

          {onOpenQuickEmployerAgent && (
            <button
              type="button"
              onClick={onOpenQuickEmployerAgent}
              className="min-h-[38px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors shadow-2xs"
            >
              <Building2 className="w-3.5 h-3.5" />
              1-Click Employer Agent
            </button>
          )}

          <button
            type="button"
            onClick={() => setProtocolDrawerOpen(true)}
            className="min-h-[38px] px-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 hover:border-zinc-400 dark:hover:border-white/25 text-xs font-medium text-zinc-900 dark:text-zinc-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Sliders className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            Protocol Inspector
          </button>
        </div>
      </div>

      {/* Pending Operations v3 Compact Gate Strip */}
      {pendingOperations.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-300 dark:bg-amber-950/20 dark:border-amber-400/30 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
              <Lock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
              <span>Pending Human Approval · Operations v3</span>
            </div>
            <span className="text-[11px] font-mono text-amber-800 dark:text-amber-300/80 tabular-nums">
              {pendingOperations.length} queued
            </span>
          </div>

          {pendingOperations.slice(0, 2).map((op) => (
            <div
              key={op.operation_id}
              className="rounded-xl bg-white dark:bg-zinc-950/90 border border-zinc-300 dark:border-white/10 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-semibold text-zinc-950 dark:text-zinc-100">{op.summary}</p>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
                  {Object.entries(op.terms).map(([k, v]) => (
                    <span key={k} className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/10 px-2 py-0.5 rounded">
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
                  className="min-h-[36px] rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-400 px-3 text-xs font-semibold dark:text-zinc-950 dark:hover:bg-emerald-300 whitespace-nowrap"
                >
                  {executingOpId === op.operation_id ? 'Executing...' : 'Approve'}
                </button>
                <button
                  type="button"
                  disabled={executingOpId === op.operation_id}
                  onClick={() => handleConfirmOperation(op, 'agent')}
                  className="min-h-[36px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap"
                >
                  Auto-Guardrail
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeclineOperation(op.operation_id);
                    emitToast('Operation declined', 'info');
                  }}
                  className="min-h-[36px] rounded-lg bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:border-rose-500/25 px-2.5 text-xs font-medium dark:text-rose-300 dark:hover:bg-rose-500/25 whitespace-nowrap"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 1: MATCHES & ROLES */}
      {activeTab === 'matches' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SwipeScrollArea direction="horizontal" innerClassName="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/10">
              {(
                [
                  { id: 'seeker', label: 'Job Seeker', icon: UserCheck },
                  { id: 'hiring', label: 'Company Pipeline', icon: Building2 },
                  { id: 'recruiter', label: 'Recruiter Agency', icon: Handshake },
                ] as const
              ).map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRoleFilter(r.id)}
                    className={`min-h-[34px] px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                      roleFilter === r.id
                        ? 'bg-white text-zinc-950 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:border-white/15 font-semibold shadow-2xs'
                        : 'text-zinc-700 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {r.label}
                  </button>
                );
              })}
            </SwipeScrollArea>

            {roleFilter === 'hiring' && (
              <button
                type="button"
                onClick={() => setNewJobOpen((v) => !v)}
                className="min-h-[38px] rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 px-3.5 text-xs font-semibold dark:text-zinc-950 dark:hover:bg-white inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Post Role
              </button>
            )}
          </div>

          {/* SEEKER VIEW */}
          {roleFilter === 'seeker' && selectedSeeker && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left: Concise Candidate Profile Card + Collapsible CV Editor */}
              <div className="lg:col-span-4 glass-panel rounded-2xl p-4 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-xs font-bold text-zinc-900 dark:text-zinc-200">
                    Candidate Profile
                  </span>
                  <select
                    value={selectedSeeker.id}
                    onChange={(e) => {
                      const found = personas.find((p) => p.id === e.target.value);
                      setSelectedSeekerId(e.target.value);
                      if (found?.linkedinUrl) setLinkedinInput(found.linkedinUrl);
                    }}
                    className="rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 max-w-[180px]"
                  >
                    {personas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold text-zinc-950 dark:text-zinc-50 truncate">
                        {selectedSeeker.displayName}
                      </p>
                      <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
                        {selectedSeeker.handle}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleBlindScreening}
                      title="Strip PII during initial agent screening"
                      className={`min-h-[30px] rounded-lg px-2.5 text-[11px] font-medium inline-flex items-center gap-1 border whitespace-nowrap shrink-0 ${
                        selectedSeeker.cvSummary?.blindScreening
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-400/30 dark:text-emerald-300'
                          : 'bg-white border-zinc-300 text-zinc-700 hover:text-zinc-950 dark:bg-zinc-900 dark:border-white/15 dark:text-zinc-400 dark:hover:text-zinc-200'
                      }`}
                    >
                      {selectedSeeker.cvSummary?.blindScreening ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                      {selectedSeeker.cvSummary?.blindScreening ? 'Blind ON' : 'Blind OFF'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(selectedSeeker.cvSummary?.parsedSkills || selectedSeeker.skills).slice(0, 5).map((sk) => (
                      <span
                        key={sk}
                        className="rounded-md bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/10 px-2 py-0.5 text-[11px] text-zinc-800 dark:text-zinc-300"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-zinc-200 dark:border-white/10 flex items-center justify-between text-xs">
                    <span className="text-zinc-600 dark:text-zinc-400">Min Target</span>
                    <span className="font-mono font-semibold text-zinc-950 dark:text-zinc-200 tabular-nums">
                      {formatMoney(selectedSeeker.cvSummary?.salaryMinZAR || 85000, currency)}/mo
                    </span>
                  </div>
                </div>

                {/* Video Liveness Summary Pill */}
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-950 dark:text-zinc-100 flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      {selectedSeeker.interviewVideo
                        ? selectedSeeker.interviewVideo.verification.verdict === 'VERIFIED_HUMAN'
                          ? `Verified (${selectedSeeker.interviewVideo.verification.authenticityScore}%)`
                          : 'Deepfake Risk'
                        : 'No Intro Video'}
                    </p>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      {selectedSeeker.interviewVideo
                        ? `${selectedSeeker.interviewVideo.preScreenReviews.length} review(s)`
                        : 'Upload or record webcam clip'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('studio')}
                    className="min-h-[34px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 hover:border-zinc-400 dark:hover:border-white/25 px-3 text-xs font-medium text-zinc-900 dark:text-zinc-200 whitespace-nowrap"
                  >
                    Open Studio
                  </button>
                </div>

                {/* Collapsible CV & LinkedIn Editor */}
                <button
                  type="button"
                  onClick={() => setCvDrawerOpen((v) => !v)}
                  className="w-full min-h-[36px] rounded-xl bg-zinc-100 dark:bg-zinc-900/70 border border-zinc-300 dark:border-white/10 px-3 text-xs font-medium text-zinc-800 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-between"
                >
                  <span>Update CV &amp; LinkedIn Source</span>
                  {cvDrawerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {cvDrawerOpen && (
                  <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
                        /u/{selectedSeeker.handle.replace('.agent', '')}/.well-known/poppy.json
                      </span>
                      <a
                        href={`/u/${selectedSeeker.handle.replace('.agent', '')}/.well-known/poppy.json`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 shrink-0"
                        title="Open user poppy.json"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <input
                      type="text"
                      value={linkedinInput}
                      onChange={(e) => setLinkedinInput(e.target.value)}
                      placeholder="LinkedIn URL"
                      className="w-full rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-950 dark:text-zinc-100"
                    />
                    <textarea
                      rows={3}
                      value={cvInputText}
                      onChange={(e) => setCvInputText(e.target.value)}
                      placeholder="Paste CV highlights..."
                      className="w-full rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-950 dark:text-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={handleParseCv}
                      disabled={parsingCv}
                      className="w-full min-h-[36px] rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 text-xs font-semibold dark:hover:bg-white inline-flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {parsingCv ? 'Extracting Skills...' : 'Extract & Save Skills'}
                    </button>
                  </div>
                )}
              </div>

              {/* Right: Job Roles with Visual Fit Rings */}
              <div className="lg:col-span-8 space-y-3">
                {/* Quick Action Summary Strip */}
                <div className="glass-panel rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-950 dark:text-zinc-50">
                      {(() => {
                        const seekerMatches = matches.filter((m) => m.seekerHandle === selectedSeeker.handle);
                        return seekerMatches.length > 0
                          ? `${seekerMatches.length} Free Job Matches for ${selectedSeeker.displayName}`
                          : `Open Roles Ready to Match (${jobs.length})`;
                      })()}
                    </p>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      Book first-round interviews directly or trigger a 1-click LinkedIn agent from any profile URL.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {(() => {
                      const topUnbooked = jobs
                        .map((job) => ({
                          job,
                          match: matches.find(
                            (m) => m.jobId === job.id && m.seekerHandle === selectedSeeker.handle
                          ),
                        }))
                        .filter((item) => item.match && item.match.status !== 'interview')
                        .sort((a, b) => (b.match?.score || 0) - (a.match?.score || 0))
                        .slice(0, 3);
                      if (topUnbooked.length === 0) return null;
                      return (
                        <button
                          type="button"
                          onClick={async () => {
                            for (let i = 0; i < topUnbooked.length; i++) {
                              await handleBookInterviewForJob(
                                topUnbooked[i].job,
                                selectedSeeker,
                                topUnbooked[i].match,
                                24 + i * 3
                              );
                            }
                          }}
                          className="min-h-[34px] rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-400 dark:text-zinc-950 dark:hover:bg-emerald-300 px-3 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <CalendarPlus className="w-3.5 h-3.5" />
                          Auto-Book Top {topUnbooked.length} Interviews
                        </button>
                      );
                    })()}
                    {onOpenQuickJobAgent && (
                      <button
                        type="button"
                        onClick={onOpenQuickJobAgent}
                        className="min-h-[34px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Linkedin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        New from LinkedIn
                      </button>
                    )}
                  </div>
                </div>

                {[...jobs]
                  .sort((a, b) => {
                    const ma = matches.find(
                      (m) => m.jobId === a.id && m.seekerHandle === selectedSeeker.handle
                    );
                    const mb = matches.find(
                      (m) => m.jobId === b.id && m.seekerHandle === selectedSeeker.handle
                    );
                    return (mb?.score || 0) - (ma?.score || 0);
                  })
                  .map((job) => {
                  const match = matches.find(
                    (m) => m.jobId === job.id && m.seekerHandle === selectedSeeker.handle
                  );
                  const isInterviewBooked = match?.status === 'interview';
                  return (
                    <div key={job.id} className="glass-panel rounded-2xl p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          {match ? (
                            <FitScoreRing score={match.score} size={48} />
                          ) : (
                            <div className="w-12 h-12 rounded-full border border-dashed border-zinc-400 dark:border-zinc-700 flex items-center justify-center text-[11px] font-mono text-zinc-600 dark:text-zinc-500 shrink-0">
                              —
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                              <span className="font-mono truncate">
                                {job.companyAgentHandle}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-medium text-zinc-800 dark:text-zinc-300 shrink-0">
                                {job.remoteMode}
                              </span>
                            </div>
                            <h3 className="font-display text-sm sm:text-base font-bold text-zinc-950 dark:text-zinc-50 mt-0.5 truncate">
                              {job.title}
                            </h3>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
                              {job.companyName} · {formatMoney(job.salaryRangeZAR[0], currency)}–{formatMoney(job.salaryRangeZAR[1], currency)}/mo
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={matchingBusyId === job.id}
                            onClick={() => handleRunMatchForJob(job, selectedSeeker)}
                            className="min-h-[36px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25 inline-flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <RefreshCw className={`w-3 h-3 ${matchingBusyId === job.id ? 'animate-spin' : ''}`} />
                            Score Fit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBookInterviewForJob(job, selectedSeeker, match)}
                            className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                              isInterviewBooked
                                ? 'bg-emerald-50 border border-emerald-300 text-emerald-800 dark:bg-emerald-500/15 dark:border-emerald-400/30 dark:text-emerald-300'
                                : 'bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-900 dark:text-zinc-100 hover:border-zinc-500'
                            }`}
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                            {isInterviewBooked ? 'Interview Booked' : 'Get Interview'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              triggerOperationsV3Gate({
                                actionType: 'apply_job',
                                summary: `Apply as ${selectedSeeker.handle} -> ${job.title}`,
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
                            className="min-h-[36px] rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 px-3.5 text-xs font-semibold dark:text-zinc-950 dark:hover:bg-white whitespace-nowrap"
                          >
                            Apply
                          </button>
                        </div>
                      </div>

                      {match && (
                        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 space-y-2.5">
                          <div className="flex items-center justify-between text-xs gap-2">
                            <span className="font-medium text-zinc-900 dark:text-zinc-200">{match.explanation}</span>
                            <span className="font-mono text-[10px] uppercase text-emerald-700 dark:text-emerald-300 shrink-0 font-semibold">
                              {match.status}
                            </span>
                          </div>
                          {match.interviewPitch && (
                            <p className="text-[11px] text-zinc-700 dark:text-zinc-300 border-t border-zinc-200 dark:border-white/10 pt-2">
                              <span className="font-semibold text-zinc-900 dark:text-zinc-100">Outreach Pitch:</span>{' '}
                              {match.interviewPitch}
                            </p>
                          )}
                          <div className="grid grid-cols-4 gap-2 text-[11px] font-mono tabular-nums">
                            <div className="bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-white/10 rounded-lg px-2.5 py-1.5">
                              <span className="text-zinc-600 dark:text-zinc-500 block text-[10px]">Skills</span>
                              <span className="text-emerald-700 dark:text-emerald-300 font-semibold">{match.factors.skillsOverlap}%</span>
                            </div>
                            <div className="bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-white/10 rounded-lg px-2.5 py-1.5">
                              <span className="text-zinc-600 dark:text-zinc-500 block text-[10px]">Exp</span>
                              <span className="text-sky-700 dark:text-sky-300 font-semibold">{match.factors.experienceFit}%</span>
                            </div>
                            <div className="bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-white/10 rounded-lg px-2.5 py-1.5">
                              <span className="text-zinc-600 dark:text-zinc-500 block text-[10px]">Comp</span>
                              <span className="text-amber-700 dark:text-amber-300 font-semibold">{match.factors.compensationFit}%</span>
                            </div>
                            <div className="bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-white/10 rounded-lg px-2.5 py-1.5">
                              <span className="text-zinc-600 dark:text-zinc-500 block text-[10px]">Culture</span>
                              <span className="text-zinc-900 dark:text-zinc-200 font-semibold">{match.factors.locationCultureFit}%</span>
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

          {/* COMPANY PIPELINE VIEW */}
          {roleFilter === 'hiring' && (
            <div className="space-y-4">
              {onOpenQuickEmployerAgent && (
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>1-Click Employer Quickstart: Post from Job URL</span>
                    </p>
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300/90 mt-0.5">
                      Paste any job listing or careers page URL. Switchboard creates your verified Employer Agent, publishes vacancies, and auto-matches candidate agents with 1-click interview invites.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenQuickEmployerAgent}
                    className="min-h-[36px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-2xs"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Post from Job URL</span>
                  </button>
                </div>
              )}

              {newJobOpen && (
                <form onSubmit={handleCreateJobSubmit} className="glass-panel rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                    Company Agent
                    <select
                      value={jobCompanyHandle}
                      onChange={(e) => setJobCompanyHandle(e.target.value)}
                      className="mt-1 w-full rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-950 dark:text-white"
                    >
                      {businesses.map((b) => (
                        <option key={b.id} value={b.handle}>
                          {b.organization} ({b.handle})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                    Role Title
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="mt-1 w-full rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-950 dark:text-white"
                      required
                    />
                  </label>
                  <label className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                    Skills (comma-separated)
                    <input
                      type="text"
                      value={jobSkillsText}
                      onChange={(e) => setJobSkillsText(e.target.value)}
                      className="mt-1 w-full rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-950 dark:text-white"
                    />
                  </label>
                  <label className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                    Screening Policy
                    <select
                      value={jobAutonomy}
                      onChange={(e) => setJobAutonomy(e.target.value as JobPostingDoc['autonomyLevel'])}
                      className="mt-1 w-full rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-950 dark:text-white"
                    >
                      <option value="approve_each">Strict HITL Approval</option>
                      <option value="shortlist_auto_offer_approve">Auto-Shortlist, Approve Offers</option>
                      <option value="blind_screening_first">Blind Screening First</option>
                    </select>
                  </label>
                  <label className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                    Min Salary (ZAR/mo)
                    <input
                      type="number"
                      value={jobSalaryMin}
                      onChange={(e) => setJobSalaryMin(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs font-mono tabular-nums text-zinc-950 dark:text-white"
                    />
                  </label>
                  <label className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                    Max Salary (ZAR/mo)
                    <input
                      type="number"
                      value={jobSalaryMax}
                      onChange={(e) => setJobSalaryMax(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs font-mono tabular-nums text-zinc-950 dark:text-white"
                    />
                  </label>
                  <div className="sm:col-span-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setNewJobOpen(false)}
                      className="rounded-lg px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 px-4 py-2 text-xs font-semibold dark:text-zinc-950 dark:hover:bg-white"
                    >
                      Publish Role
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matches.map((m) => {
                  const candidateAgent = agents.find((a) => a.handle === m.seekerHandle);
                  const linkedJob = jobs.find((j) => j.id === m.jobId);
                  const videoVer = candidateAgent?.interviewVideo?.verification;
                  return (
                    <div key={m.id} className="glass-panel rounded-2xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <FitScoreRing score={m.score} size={46} />
                          <div className="min-w-0">
                            <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
                              {m.blindMode ? 'BLIND_TOKEN' : m.seekerHandle}
                            </p>
                            <h4 className="font-display text-sm font-bold text-zinc-950 dark:text-zinc-50 truncate">
                              {m.seekerName}
                            </h4>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">{m.jobTitle}</p>
                          </div>
                        </div>

                        {videoVer && (
                          <span
                            className={`text-[11px] font-mono font-semibold inline-flex items-center gap-1 px-2 py-0.5 rounded-md border shrink-0 tabular-nums ${
                              videoVer.verdict === 'VERIFIED_HUMAN'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-400/25 dark:text-emerald-300'
                                : 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-500/10 dark:border-rose-400/25 dark:text-rose-300'
                            }`}
                          >
                            <ShieldCheck className="w-3 h-3" />
                            {videoVer.authenticityScore}% Real
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedMatchId(expandedMatchId === m.id ? null : m.id)}
                        className="text-xs text-sky-700 dark:text-sky-400 hover:underline inline-flex items-center gap-1 font-medium"
                      >
                        {expandedMatchId === m.id ? 'Hide breakdown' : 'Factor breakdown'}
                      </button>

                      {expandedMatchId === m.id && (
                        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 space-y-1 text-xs">
                          <p className="text-zinc-800 dark:text-zinc-300">{m.explanation}</p>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Strengths: {m.strengths.join(' · ')}</p>
                          <p className="text-[11px] text-amber-700 dark:text-amber-300">Gaps: {m.gaps.join(' · ')}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-zinc-200 dark:border-white/10">
                        <span className="text-[11px] font-mono uppercase text-zinc-600 dark:text-zinc-400 font-medium">
                          {m.status}
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
                              className="min-h-[32px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25 inline-flex items-center gap-1"
                            >
                              <Video className="w-3 h-3" />
                              Call
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
                            className="min-h-[32px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25"
                          >
                            Shortlist
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              triggerOperationsV3Gate({
                                actionType: 'book_interview',
                                summary: `Book Interview: ${m.seekerName} with ${m.companyAgentHandle}`,
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
                            className="min-h-[32px] rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 px-2.5 text-xs font-semibold dark:text-zinc-950 dark:hover:bg-white"
                          >
                            Book Interview
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* RECRUITER AGENCY VIEW */}
          {roleFilter === 'recruiter' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {jobs.map((job) => {
                const estAnnualZAR = job.salaryRangeZAR[1] * 12;
                const estFeeZAR = Math.round(estAnnualZAR * 0.12);
                return (
                  <div key={job.id} className="glass-panel rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                      <span>{job.companyName}</span>
                      <span className="text-emerald-700 dark:text-emerald-300 font-semibold">12% x402 Escrow</span>
                    </div>
                    <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-zinc-50">
                      {job.title}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
                      Est. Fee:{' '}
                      <span className="font-mono font-semibold text-zinc-950 dark:text-zinc-100">
                        {formatMoney(estFeeZAR, currency)}
                      </span>
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-white/10 gap-2">
                      <a
                        href={job.poppyDiscoveryPath}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-mono text-sky-700 dark:text-sky-400 hover:underline truncate"
                      >
                        poppy.json
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setConvTarget(job.companyAgentHandle);
                          setProtocolDrawerTab('conversations');
                          setProtocolDrawerOpen(true);
                        }}
                        className="min-h-[34px] rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 px-3 text-xs font-semibold dark:text-zinc-950 dark:hover:bg-white whitespace-nowrap"
                      >
                        Mediate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: VIDEO & LIVE STUDIO */}
      {activeTab === 'studio' && selectedSeeker && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-zinc-50">
                Candidate Media &amp; Live Call
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Deepfake check, pre-screening &amp; calendar invite
              </p>
            </div>
            <select
              value={selectedSeeker.id}
              onChange={(e) => {
                const found = personas.find((p) => p.id === e.target.value);
                setSelectedSeekerId(e.target.value);
                if (found?.linkedinUrl) setLinkedinInput(found.linkedinUrl);
              }}
              className="rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-200"
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

      {/* TAB 3: CONSENT & PROTOCOL SPEC */}
      {activeTab === 'consent' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left: POPIA Consent Scopes */}
          <div className="lg:col-span-7 glass-panel rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-zinc-50">
                  Active Consent Grants
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Poppy OAuth scopes &amp; POPIA §11 revocation
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setProtocolDrawerTab('validator');
                    setProtocolDrawerOpen(true);
                  }}
                  className="min-h-[34px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25 whitespace-nowrap"
                >
                  Open poppy.json Inspector
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRevokeAllConsents();
                    emitToast('All Poppy consents revoked', 'warning');
                  }}
                  className="min-h-[34px] rounded-lg bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:border-rose-400/30 px-3 text-xs font-semibold dark:text-rose-300 dark:hover:bg-rose-500/25 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Revoke All
                </button>
              </div>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-white/[0.08] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10">
              {poppyConsents.map((c) => (
                <div key={c.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-zinc-950 dark:text-zinc-100 font-medium">{c.scope}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-medium ${
                          c.changes === 'irreversible'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                        }`}
                      >
                        {c.changes}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-400 mt-0.5 truncate">{c.summary}</p>
                    <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-500 truncate">
                      {c.agentHandle} → {c.targetHandle}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleConsentScope(c.id);
                      emitToast(`${c.scope} ${c.granted ? 'revoked' : 'granted'}`, 'info');
                    }}
                    className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold shrink-0 whitespace-nowrap ${
                      c.granted
                        ? 'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-zinc-950'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 border border-zinc-300 dark:border-white/15'
                    }`}
                  >
                    {c.granted ? 'Granted' : 'Revoked'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Compliance Audit Trail */}
          <div className="lg:col-span-5 glass-panel rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-zinc-50">
                Compliance Audit Trail
              </h3>
              <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-500 tabular-nums">
                {poppyAuditLogs.length} events
              </span>
            </div>
            <SwipeScrollArea direction="vertical" className="max-h-[360px]" innerClassName="space-y-2">
              {poppyAuditLogs.map((log) => (
                <div key={log.id} className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-2.5 text-xs">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-zinc-950 dark:text-zinc-200 font-semibold">{log.action}</span>
                    <span className="text-zinc-600 dark:text-zinc-500 tabular-nums">
                      {new Date(log.timestamp).toLocaleTimeString('en-ZA', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-zinc-700 dark:text-zinc-400 mt-0.5 text-[11px] line-clamp-2">{log.details}</p>
                </div>
              ))}
            </SwipeScrollArea>
          </div>
        </div>
      )}

      {/* SLIDE-OVER PROTOCOL & POPPY.JSON INSPECTOR DRAWER */}
      {protocolDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/60 dark:bg-black/75 backdrop-blur-sm flex justify-end"
          onClick={() => setProtocolDrawerOpen(false)}
        >
          <div
            className="w-full max-w-2xl h-full bg-white dark:bg-[#0c0c0f] border-l border-zinc-300 dark:border-white/10 flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setProtocolDrawerOpen(false)}
                  className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white shrink-0 transition-colors"
                  aria-label="Back to Hiring"
                  title="Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-zinc-50 truncate">
                    Poppy v1.0 Protocol Inspector
                  </h3>
                  <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-500 truncate">
                    Conversations, Extensions, poppy.json &amp; Task Coverage
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProtocolDrawerOpen(false)}
                className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white shrink-0 transition-colors"
                aria-label="Close Protocol Inspector"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 py-2 border-b border-zinc-200 dark:border-white/10 flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'conversations', label: 'Conversations', icon: MessageSquare },
                  { id: 'validator', label: 'poppy.json Validator', icon: FileCheck2 },
                  { id: 'tasks', label: 'Tasks §9 & Feedback', icon: Sparkles },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setProtocolDrawerTab(t.id)}
                    className={`min-h-[34px] px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap ${
                      protocolDrawerTab === t.id
                        ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                        : 'text-zinc-700 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <SwipeScrollArea direction="vertical" className="flex-1 min-h-0" innerClassName="p-4 space-y-4">
              {protocolDrawerTab === 'conversations' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs text-zinc-700 dark:text-zinc-400 font-medium">
                      Target Agent
                      <select
                        value={convTarget}
                        onChange={(e) => setConvTarget(e.target.value)}
                        className="mt-1 w-full rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-950 dark:text-white"
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
                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        disabled={convBusy}
                        onClick={() => startPoppyConversation()}
                        className="flex-1 min-h-[38px] rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 px-3 text-xs font-semibold dark:text-zinc-950 dark:hover:bg-white"
                      >
                        Start Session
                      </button>
                      <button
                        type="button"
                        onClick={testBrowserSessionJoin}
                        className="min-h-[38px] rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25 whitespace-nowrap"
                      >
                        Browser Join (§6)
                      </button>
                    </div>
                  </div>

                  {browserJoinInfo && (
                    <p className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-zinc-950 border border-emerald-300 dark:border-emerald-400/25 rounded-lg p-2.5">
                      {browserJoinInfo}
                    </p>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {OFFICIAL_POPPY_EXTENSIONS.map((ext) => (
                      <label
                        key={ext.name}
                        className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 px-2.5 py-2 cursor-pointer text-xs"
                      >
                        <span className="font-mono text-[11px] text-zinc-900 dark:text-zinc-200 truncate">
                          {ext.name} <span className="text-zinc-600 dark:text-zinc-500">v{ext.version}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(enabledExtensions[ext.name])}
                          onChange={() =>
                            setEnabledExtensions((prev) => ({ ...prev, [ext.name]: !prev[ext.name] }))
                          }
                          className="accent-zinc-950 dark:accent-sky-400"
                        />
                      </label>
                    ))}
                  </div>

                  {activeConv && (
                    <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-200 dark:border-white/10">
                        <span className="text-[11px] font-mono text-zinc-800 dark:text-zinc-300">
                          {activeConv.id} · {activeConv.status} · {activeConv.browserController}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => triggerConversationControl('handoff')}
                            className="rounded-md bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300"
                          >
                            Handoff
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerConversationControl('handoff/cancel')}
                            className="rounded-md bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2 py-1 text-[11px] font-medium text-zinc-800 dark:text-zinc-300"
                          >
                            Cancel Handoff
                          </button>
                          <button
                            type="button"
                            onClick={() => startPoppyConversation(activeConv.id)}
                            className="rounded-md bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2 py-1 text-[11px] font-medium text-sky-700 dark:text-sky-300"
                          >
                            Direct Conv
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerConversationControl('close')}
                            className="rounded-md bg-rose-50 border border-rose-300 text-rose-700 dark:bg-rose-500/15 dark:border-rose-400/25 px-2 py-1 text-[11px] font-medium dark:text-rose-300"
                          >
                            Close
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-[260px] overflow-y-auto no-scrollbar">
                        {activeConv.events.map((evt) => (
                          <div key={evt.id} className="rounded-lg bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-white/10 p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
                              <span>
                                [{evt.author.type.toUpperCase()}] {evt.author.name}
                              </span>
                              <span>#{evt.cursor}</span>
                            </div>
                            <p className="text-xs text-zinc-900 dark:text-zinc-200">{evt.text}</p>
                            {evt.extensions?.disclosures?.items.map((disc) => (
                              <div
                                key={disc.id}
                                className="rounded bg-amber-50 border border-amber-300 text-amber-800 dark:bg-amber-950/30 dark:border-amber-400/25 px-2 py-1 text-[11px] dark:text-amber-200 flex items-start gap-1.5"
                              >
                                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                <span>
                                  <strong>{disc.category}:</strong> {disc.text}
                                </span>
                              </div>
                            ))}
                            {evt.extensions?.links?.items && (
                              <div className="flex flex-wrap gap-1">
                                {evt.extensions.links.items.map((lnk) => (
                                  <a
                                    key={lnk.url}
                                    href={lnk.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2 py-0.5 text-[10px] text-sky-700 dark:text-sky-400"
                                  >
                                    <LinkIcon className="w-2.5 h-2.5" />
                                    {lnk.title}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {activeConv.status !== 'closed' && (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={convMsg}
                            onChange={(e) => setConvMsg(e.target.value)}
                            className="flex-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-950 dark:text-white"
                          />
                          <button
                            type="button"
                            disabled={convBusy}
                            onClick={() => sendPoppyMessage()}
                            className="min-h-[36px] rounded-lg bg-zinc-950 text-white dark:bg-zinc-50 px-3 text-xs font-semibold dark:text-zinc-950 inline-flex items-center gap-1"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Send
                          </button>
                          <button
                            type="button"
                            disabled={convBusy}
                            onClick={() => sendPoppyMessage({ simulateUcp: true, action: 'settle_fee' })}
                            className="min-h-[36px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                          >
                            +Op/UCP
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {protocolDrawerTab === 'validator' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
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
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] font-mono border transition-colors ${
                          manifestPath === ep
                            ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-white font-semibold'
                            : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-white/25'
                        }`}
                      >
                        {ep}
                      </button>
                    ))}
                  </div>

                  {validationReport && (
                    <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-zinc-950 dark:text-zinc-100">Validation Result</span>
                        <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                          {validationReport.score}% ({validationReport.valid ? 'VALID' : 'INCOMPLETE'})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                        {validationReport.checks.map((chk) => (
                          <div key={chk.field} className="flex items-start gap-1.5 text-zinc-700 dark:text-zinc-300">
                            {chk.passed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                            )}
                            <span className="truncate">
                              <strong className="text-zinc-950 dark:text-zinc-100">{chk.field}:</strong> {chk.detail}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <pre className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 text-[11px] font-mono text-zinc-900 dark:text-emerald-300 overflow-x-auto max-h-[320px]">
                    {loadingManifest
                      ? 'Fetching manifest...'
                      : manifestRaw || 'Select an endpoint above to validate.'}
                  </pre>
                </div>
              )}

              {protocolDrawerTab === 'tasks' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-950 dark:text-zinc-100">
                      Excluded Tasks &amp; Feedback (§9)
                    </span>
                    <button
                      type="button"
                      onClick={inspectTasksEndpoint}
                      className="min-h-[34px] rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25"
                    >
                      Fetch /api/poppy/tasks
                    </button>
                  </div>
                  {tasksData && (
                    <pre className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 text-[11px] font-mono text-zinc-900 dark:text-emerald-300 overflow-x-auto max-h-[220px]">
                      {tasksData}
                    </pre>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="Request missing Poppy task capability..."
                      className="flex-1 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-950 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={submitTaskFeedback}
                      className="min-h-[36px] rounded-lg bg-zinc-950 text-white dark:bg-zinc-50 px-3 text-xs font-semibold dark:text-zinc-950"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
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
        onSubmitReview={(agentId, review) => {
          onAddPreScreenReview(agentId, review);
          emitToast('Interview scorecard saved', 'success');
        }}
      />
    </div>
  );
};
