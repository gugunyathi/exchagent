import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  X,
  Building2,
  Users,
  Trophy,
  FileText,
  Download,
  History,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  CalendarPlus,
  MessageSquarePlus,
  UserPlus,
  ExternalLink,
  Award,
  Clock,
} from 'lucide-react';
import {
  AgentDoc,
  AgentApplicationPackage,
  AgentActionHistoryEntry,
  HrTeamMember,
  JobPostingDoc,
  RecruitmentMatchDoc,
  CurrencyMode,
  formatMoney,
} from '../types/firestore';
import {
  downloadCvAsPdf,
  downloadCvAsDocx,
  downloadCoverLetterAsPdf,
  downloadCoverLetterAsDocx,
} from '../lib/docExport';
import { emitToast } from '../lib/toast';

interface CompanyHrPortalModalProps {
  open: boolean;
  onClose: () => void;
  companyAgent: AgentDoc | null;
  allBusinessAgents: AgentDoc[];
  onSelectCompany: (agent: AgentDoc) => void;
  allAgents: AgentDoc[];
  jobs: JobPostingDoc[];
  matches: RecruitmentMatchDoc[];
  applicationPackages: AgentApplicationPackage[];
  history: AgentActionHistoryEntry[];
  currency: CurrencyMode;
  onRecordHrDocView: (packageId: string, reviewer: { name: string; role: string }) => void;
  onAddHrNote: (packageId: string, authorName: string, authorRole: string, note: string) => void;
  onUpdateApplicationStatus: (
    packageId: string,
    nextStatus: AgentApplicationPackage['status'],
    reviewer?: { name: string; role: string }
  ) => void;
  onAddHrTeamMember: (companyAgentId: string, member: Omit<HrTeamMember, 'id' | 'addedAt'>) => HrTeamMember | void;
  onLogHistory: (entry: Omit<AgentActionHistoryEntry, 'id' | 'timestamp'>) => void;
}

export const CompanyHrPortalModal: React.FC<CompanyHrPortalModalProps> = ({
  open,
  onClose,
  companyAgent,
  allBusinessAgents,
  onSelectCompany,
  allAgents,
  jobs,
  matches,
  applicationPackages,
  history,
  currency,
  onRecordHrDocView,
  onAddHrNote,
  onUpdateApplicationStatus,
  onAddHrTeamMember,
  onLogHistory,
}) => {
  const [activeTab, setActiveTab] = useState<'appliers' | 'docs' | 'history' | 'access'>('appliers');
  const [selectedJobId, setSelectedJobId] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [blindReview, setBlindReview] = useState(false);
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null);
  const [docViewMode, setDocViewMode] = useState<'cv' | 'cover_letter'>('cv');
  const [noteDraft, setNoteDraft] = useState('');

  // Active HR Reviewer Identity
  const hrRoster: HrTeamMember[] = useMemo(() => {
    if (companyAgent?.hrTeam && companyAgent.hrTeam.length > 0) {
      return companyAgent.hrTeam;
    }
    if (!companyAgent) return [];
    return [
      {
        id: 'hr_default_admin',
        name: `${companyAgent.displayName} Lead Recruiter`,
        roleTitle: 'Head of Talent Acquisition',
        email: companyAgent.agentEmail,
        agentHandle: `hr.${companyAgent.handle}`,
        permissions: ['view_docs', 'shortlist', 'interview', 'offer', 'manage_team'],
        addedAt: new Date().toISOString(),
      },
    ];
  }, [companyAgent]);

  const [activeReviewerId, setActiveReviewerId] = useState<string>(hrRoster[0]?.id || '');

  useEffect(() => {
    if (hrRoster.length > 0 && !hrRoster.some((r) => r.id === activeReviewerId)) {
      setActiveReviewerId(hrRoster[0].id);
    }
  }, [hrRoster, activeReviewerId]);

  const activeReviewer =
    hrRoster.find((r) => r.id === activeReviewerId) || hrRoster[0];

  // New HR Team Member Form
  const [newHrName, setNewHrName] = useState('');
  const [newHrRole, setNewHrRole] = useState('Regional Technical Recruiter');
  const [newHrEmail, setNewHrEmail] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const companyJobs = useMemo(() => {
    if (!companyAgent) return [];
    return jobs.filter((j) => j.companyAgentHandle === companyAgent.handle);
  }, [companyAgent, jobs]);

  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    companyJobs.forEach((j) => set.add(j.regionZone || j.location));
    return Array.from(set);
  }, [companyJobs]);

  const companyPackages = useMemo(() => {
    if (!companyAgent) return [];
    return applicationPackages
      .filter((p) => p.companyAgentHandle === companyAgent.handle)
      .filter((p) => (selectedJobId === 'all' ? true : p.jobId === selectedJobId))
      .filter((p) => (selectedRegion === 'all' ? true : p.regionZone === selectedRegion))
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [companyAgent, applicationPackages, selectedJobId, selectedRegion]);

  // Unified Ranked Top Appliers (submitted packages + high-fit matches)
  const topAppliers = useMemo(() => {
    if (!companyAgent) return [];
    const byKey = new Map<
      string,
      {
        key: string;
        jobId: string;
        jobTitle: string;
        regionZone: string;
        seekerHandle: string;
        seekerName: string;
        score: number;
        status: string;
        hasDocs: boolean;
        pkg?: AgentApplicationPackage;
        match?: RecruitmentMatchDoc;
        livenessScore?: number;
      }
    >();

    companyPackages.forEach((pkg) => {
      const cand = allAgents.find((a) => a.handle === pkg.seekerHandle);
      const key = `${pkg.jobId}__${pkg.seekerHandle}`;
      byKey.set(key, {
        key,
        jobId: pkg.jobId,
        jobTitle: pkg.jobTitle,
        regionZone: pkg.regionZone,
        seekerHandle: pkg.seekerHandle,
        seekerName: pkg.seekerName,
        score: pkg.matchScore,
        status: pkg.status,
        hasDocs: true,
        pkg,
        livenessScore: cand?.interviewVideo?.verification?.authenticityScore,
      });
    });

    matches
      .filter((m) => m.companyAgentHandle === companyAgent.handle)
      .filter((m) => (selectedJobId === 'all' ? true : m.jobId === selectedJobId))
      .forEach((m) => {
        const linkedJob = companyJobs.find((j) => j.id === m.jobId);
        const zone = linkedJob?.regionZone || linkedJob?.location || 'Global';
        if (selectedRegion !== 'all' && zone !== selectedRegion) return;
        const key = `${m.jobId}__${m.seekerHandle}`;
        const existing = byKey.get(key);
        if (existing) {
          existing.match = m;
        } else {
          const cand = allAgents.find((a) => a.handle === m.seekerHandle);
          byKey.set(key, {
            key,
            jobId: m.jobId,
            jobTitle: m.jobTitle,
            regionZone: zone,
            seekerHandle: m.seekerHandle,
            seekerName: m.seekerName,
            score: m.score,
            status: m.status,
            hasDocs: false,
            match: m,
            livenessScore: cand?.interviewVideo?.verification?.authenticityScore,
          });
        }
      });

    return Array.from(byKey.values()).sort((a, b) => {
      if (a.hasDocs !== b.hasDocs) return a.hasDocs ? -1 : 1;
      return b.score - a.score;
    });
  }, [companyAgent, companyPackages, matches, companyJobs, selectedJobId, selectedRegion, allAgents]);

  const companyHistory = useMemo(() => {
    if (!companyAgent) return [];
    return history
      .filter(
        (h) =>
          h.agentHandle === companyAgent.handle ||
          h.agentId === companyAgent.id ||
          h.targetHandle === companyAgent.handle
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [companyAgent, history]);

  const selectedPkg =
    companyPackages.find((p) => p.id === selectedPkgId) || companyPackages[0] || null;

  if (!open || !companyAgent) return null;

  const inspectPackageDocs = (pkg: AgentApplicationPackage) => {
    setSelectedPkgId(pkg.id);
    setActiveTab('docs');
    if (activeReviewer) {
      onRecordHrDocView(pkg.id, {
        name: activeReviewer.name,
        role: activeReviewer.roleTitle,
      });
    }
  };

  const handleHrExport = async (kind: 'cv_pdf' | 'cv_docx' | 'cl_pdf' | 'cl_docx') => {
    if (!selectedPkg) return;
    let filename = '';
    if (kind === 'cv_pdf') filename = downloadCvAsPdf(selectedPkg.cvDoc);
    if (kind === 'cv_docx') filename = await downloadCvAsDocx(selectedPkg.cvDoc);
    if (kind === 'cl_pdf') filename = downloadCoverLetterAsPdf(selectedPkg.coverLetterDoc);
    if (kind === 'cl_docx') filename = await downloadCoverLetterAsDocx(selectedPkg.coverLetterDoc);

    onLogHistory({
      agentId: companyAgent.id,
      agentHandle: companyAgent.handle,
      actorType: 'hr_staff',
      actorName: activeReviewer ? `${activeReviewer.name} (${activeReviewer.roleTitle})` : 'HR Staff',
      actionType: 'DOC_EXPORTED',
      title: `HR Downloaded ${selectedPkg.seekerName} ${kind.includes('cv') ? 'CV' : 'Cover Letter'}`,
      details: `Exported ${filename} for "${selectedPkg.jobTitle}".`,
      relatedJobId: selectedPkg.jobId,
      relatedJobTitle: selectedPkg.jobTitle,
      relatedPackageId: selectedPkg.id,
      targetHandle: selectedPkg.seekerHandle,
      channel: 'HR Staff Portal',
    });
    emitToast(`Downloaded ${filename}`, 'success');
  };

  const handleAddHrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHrName.trim() || !newHrEmail.trim()) return;
    const slug = newHrName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'recruiter';
    const created = onAddHrTeamMember(companyAgent.id, {
      name: newHrName.trim(),
      roleTitle: newHrRole.trim() || 'Recruiting Partner',
      email: newHrEmail.trim(),
      agentHandle: `${slug}.hr.${companyAgent.handle}`,
      permissions: ['view_docs', 'shortlist', 'interview'],
    });
    setNewHrName('');
    setNewHrEmail('');
    if (created && typeof created === 'object' && 'id' in created) {
      setActiveReviewerId((created as HrTeamMember).id);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/65 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl glass-panel rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 space-y-4 max-h-[92dvh] flex flex-col overflow-hidden pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="sm:hidden w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto -mt-1" />

        {/* Header: Back + Company Selector + Active HR Staff Switcher + Close */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0"
              aria-label="Back"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-zinc-950 dark:text-white truncate">
                  {companyAgent.displayName} · HR &amp; Top Appliers Portal
                </h2>
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              </div>
              <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
                {companyAgent.handle} · {companyJobs.length} open vacancies · {companyPackages.length} submitted dossiers
                {companyAgent.careersUrl ? ` · ${companyAgent.careersUrl}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {allBusinessAgents.length > 1 && (
              <select
                value={companyAgent.id}
                onChange={(e) => {
                  const found = allBusinessAgents.find((b) => b.id === e.target.value);
                  if (found) {
                    onSelectCompany(found);
                    setSelectedJobId('all');
                    setSelectedRegion('all');
                    setSelectedPkgId(null);
                  }
                }}
                className="min-h-[34px] rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-xs text-zinc-900 dark:text-zinc-100 max-w-[165px]"
                title="Switch Company Agent"
              >
                {allBusinessAgents.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.displayName}
                  </option>
                ))}
              </select>
            )}

            {hrRoster.length > 0 && (
              <select
                value={activeReviewer?.id || ''}
                onChange={(e) => setActiveReviewerId(e.target.value)}
                className="min-h-[34px] rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/30 px-2.5 text-xs font-medium text-emerald-900 dark:text-emerald-200 max-w-[190px]"
                title="Active Authorized HR Staff"
              >
                {hrRoster.map((hr) => (
                  <option key={hr.id} value={hr.id}>
                    HR: {hr.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0"
              aria-label="Close modal"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Portal Tabs + Role / Region Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/10">
            {[
              { id: 'appliers' as const, label: `Top Appliers (${topAppliers.length})`, icon: Trophy },
              { id: 'docs' as const, label: `Candidate Docs (${companyPackages.length})`, icon: FileText },
              { id: 'history' as const, label: `Company & HR History (${companyHistory.length})`, icon: History },
              { id: 'access' as const, label: `HR Staff Roster (${hrRoster.length})`, icon: Users },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`min-h-[34px] px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    activeTab === t.id
                      ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                      : 'text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {regionOptions.length > 0 && (
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="min-h-[32px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-xs text-zinc-800 dark:text-zinc-200 max-w-[180px]"
              >
                <option value="all">All Regions ({regionOptions.length})</option>
                {regionOptions.map((rz) => (
                  <option key={rz} value={rz}>
                    {rz}
                  </option>
                ))}
              </select>
            )}

            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="min-h-[32px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-xs text-zinc-800 dark:text-zinc-200 max-w-[200px]"
            >
              <option value="all">All Open Roles ({companyJobs.length})</option>
              {companyJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setBlindReview((v) => !v)}
              className={`min-h-[32px] px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 ${
                blindReview
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-500/15 dark:border-emerald-400/30 dark:text-emerald-300'
                  : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300'
              }`}
              title="Toggle bias-free blind screening view"
            >
              {blindReview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{blindReview ? 'Blind Review ON' : 'Blind Review'}</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-4">
          {/* TAB 1: TOP APPLIERS RANKING */}
          {activeTab === 'appliers' && (
            <div className="space-y-3">
              {companyAgent.careersUrl && (
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-zinc-700 dark:text-zinc-300 truncate">
                      Synced Vacancies ({companyJobs.length} regions/zones) from{' '}
                      <span className="font-mono font-semibold text-zinc-950 dark:text-white">
                        {companyAgent.careersUrl}
                      </span>
                    </span>
                  </div>
                  <a
                    href={companyAgent.careersUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-400 hover:underline font-medium shrink-0"
                  >
                    Open Source Page <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {topAppliers.length === 0 ? (
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-6 text-center text-xs text-zinc-600 dark:text-zinc-400">
                  No appliers or matched candidates found for this filter yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {topAppliers.map((ap, idx) => {
                    const displayCandidateName = blindReview
                      ? `Candidate #${idx + 1} (${ap.seekerHandle.slice(0, 4)}***)`
                      : ap.seekerName;
                    const jobRef = companyJobs.find((j) => j.id === ap.jobId);
                    return (
                      <div
                        key={ap.key}
                        className="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-3.5 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums">
                              <span className="font-bold text-amber-700 dark:text-amber-400">
                                Rank #{idx + 1}
                              </span>
                              <span>·</span>
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                {ap.score}% Fit
                              </span>
                              <span>·</span>
                              <span className="uppercase text-zinc-600 dark:text-zinc-400">
                                {ap.status}
                              </span>
                              {ap.livenessScore && (
                                <>
                                  <span>·</span>
                                  <span className="text-sky-700 dark:text-sky-400">
                                    Liveness {ap.livenessScore}%
                                  </span>
                                </>
                              )}
                            </div>
                            <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-white mt-0.5 truncate">
                              {displayCandidateName}
                            </h3>
                            <p className="text-xs text-zinc-700 dark:text-zinc-300 truncate">
                              {ap.jobTitle} · <span className="font-mono text-[11px]">{ap.regionZone}</span>
                            </p>
                            {jobRef && (
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                                Band: {formatMoney(jobRef.salaryRangeZAR[0], currency)}–{formatMoney(jobRef.salaryRangeZAR[1], currency)}/mo
                              </p>
                            )}
                          </div>
                        </div>

                        {ap.pkg ? (
                          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-200 dark:border-white/10">
                            <button
                              type="button"
                              onClick={() => inspectPackageDocs(ap.pkg!)}
                              className="min-h-[32px] px-3 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white text-xs font-semibold inline-flex items-center gap-1.5"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Inspect CV &amp; Letter
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateApplicationStatus(ap.pkg!.id, 'shortlisted', {
                                  name: activeReviewer.name,
                                  role: activeReviewer.roleTitle,
                                })
                              }
                              className="min-h-[32px] px-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-500 inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Shortlist
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateApplicationStatus(ap.pkg!.id, 'interview', {
                                  name: activeReviewer.name,
                                  role: activeReviewer.roleTitle,
                                })
                              }
                              className="min-h-[32px] px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1"
                            >
                              <CalendarPlus className="w-3 h-3" />
                              Invite
                            </button>
                          </div>
                        ) : (
                          <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 pt-2 border-t border-zinc-200 dark:border-white/10">
                            Auto-Matched Candidate · Awaiting tailored dossier submission
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CANDIDATE SUBMITTED DOCS + HR NOTES + PDF/DOCX DOWNLOAD */}
          {activeTab === 'docs' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-4 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Submitted Dossiers ({companyPackages.length})
                </p>
                {companyPackages.map((pkg, idx) => {
                  const active = selectedPkg?.id === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => inspectPackageDocs(pkg)}
                      className={`w-full text-left rounded-xl p-3 border transition-colors space-y-1 ${
                        active
                          ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-white'
                          : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10 hover:border-zinc-400'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {pkg.matchScore}% · {pkg.status.toUpperCase()}
                        </span>
                        <span>{pkg.regionZone}</span>
                      </div>
                      <p className="font-display text-xs font-bold truncate">
                        {blindReview ? `Candidate #${idx + 1}` : pkg.seekerName}
                      </p>
                      <p className={`text-[11px] truncate ${active ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-600 dark:text-zinc-400'}`}>
                        {pkg.jobTitle}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="lg:col-span-8">
                {selectedPkg ? (
                  <div className="rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-white/10">
                      <div className="min-w-0">
                        <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-white truncate">
                          {blindReview ? 'Anonymous Blind Candidate Dossier' : selectedPkg.seekerName} · {selectedPkg.jobTitle}
                        </h3>
                        <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                          {selectedPkg.regionZone} · Match {selectedPkg.matchScore}% · Status: {selectedPkg.status.toUpperCase()}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleHrExport(docViewMode === 'cv' ? 'cv_pdf' : 'cl_pdf')}
                          className="min-h-[32px] px-2.5 rounded-lg bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => handleHrExport(docViewMode === 'cv' ? 'cv_docx' : 'cl_docx')}
                          className="min-h-[32px] px-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          DOCX
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => setDocViewMode('cv')}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                            docViewMode === 'cv'
                              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold'
                              : 'text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          Candidate Tailored CV
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocViewMode('cover_letter')}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                            docViewMode === 'cover_letter'
                              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold'
                              : 'text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          Cover Letter
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {(['shortlisted', 'interview', 'offer'] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() =>
                              onUpdateApplicationStatus(selectedPkg.id, st, {
                                name: activeReviewer.name,
                                role: activeReviewer.roleTitle,
                              })
                            }
                            className={`min-h-[30px] px-2.5 rounded-lg text-[11px] font-semibold capitalize border ${
                              selectedPkg.status === st
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>

                    {docViewMode === 'cv' ? (
                      <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 p-4 space-y-3 text-xs">
                        <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed">
                          {selectedPkg.cvDoc.professionalSummary}
                        </p>
                        <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                          Matched Spec Keywords: {selectedPkg.cvDoc.matchedKeywords.join(', ')}
                        </p>
                        <div className="space-y-2">
                          {selectedPkg.cvDoc.experienceHighlights.map((exp, i) => (
                            <div key={i} className="space-y-1">
                              <p className="font-semibold text-zinc-950 dark:text-white">
                                {exp.role} — {exp.org} ({exp.period})
                              </p>
                              <ul className="list-disc pl-4 space-y-0.5 text-zinc-700 dark:text-zinc-300">
                                {exp.bullets.map((b, bi) => (
                                  <li key={bi}>{b}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 p-4 space-y-2.5 text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
                        <p className="font-semibold text-sky-700 dark:text-sky-400">
                          RE: {selectedPkg.coverLetterDoc.subject}
                        </p>
                        <p>{selectedPkg.coverLetterDoc.openingParagraph}</p>
                        {selectedPkg.coverLetterDoc.bodyParagraphs.map((bp, idx) => (
                          <p key={idx}>{bp}</p>
                        ))}
                        <p>{selectedPkg.coverLetterDoc.closingParagraph}</p>
                      </div>
                    )}

                    {/* HR Notes & Audit */}
                    <div className="pt-3 border-t border-zinc-200 dark:border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          HR Staff Notes ({selectedPkg.hrNotes.length})
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500">
                          Posting as {activeReviewer?.name}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="Add hiring committee evaluation note..."
                          className="flex-1 min-h-[36px] rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 text-xs text-zinc-950 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!noteDraft.trim() || !activeReviewer) return;
                            onAddHrNote(
                              selectedPkg.id,
                              activeReviewer.name,
                              activeReviewer.roleTitle,
                              noteDraft
                            );
                            setNoteDraft('');
                          }}
                          className="min-h-[36px] px-3 rounded-lg bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <MessageSquarePlus className="w-3.5 h-3.5" />
                          Add Note
                        </button>
                      </div>

                      {selectedPkg.hrNotes.map((n) => (
                        <div
                          key={n.id}
                          className="rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 p-2.5 text-xs"
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                            <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                              {n.authorName} · {n.authorRole}
                            </span>
                            <span>{new Date(n.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-zinc-700 dark:text-zinc-300 mt-1">{n.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-6 text-center text-xs text-zinc-600 dark:text-zinc-400">
                    Select an applicant dossier to view CV, Cover Letter, and download PDF/DOCX.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: COMPANY AGENT & HR ACTION HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-2">
              {companyHistory.length === 0 ? (
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-6 text-center text-xs text-zinc-600 dark:text-zinc-400">
                  No HR or company agent actions recorded yet.
                </div>
              ) : (
                companyHistory.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {item.actionType}
                        </span>
                        <span>·</span>
                        <span>{item.actorName}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="w-3 h-3" />
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="font-display text-xs sm:text-sm font-bold text-zinc-950 dark:text-white">
                        {item.title}
                      </p>
                      <p className="text-xs text-zinc-700 dark:text-zinc-300">{item.details}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: HR STAFF ACCESS ROSTER */}
          {activeTab === 'access' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-7 space-y-2">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Authorized HR &amp; Recruiting Staff ({hrRoster.length})
                </p>
                {hrRoster.map((hr) => (
                  <div
                    key={hr.id}
                    className="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-display text-xs sm:text-sm font-bold text-zinc-950 dark:text-white">
                        {hr.name}
                      </p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        {hr.roleTitle} · <span className="font-mono text-[11px]">{hr.email}</span>
                      </p>
                      <p className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                        Permissions: {hr.permissions.join(' · ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveReviewerId(hr.id)}
                      className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold ${
                        activeReviewer?.id === hr.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200'
                      }`}
                    >
                      {activeReviewer?.id === hr.id ? 'Active Session' : 'Act as Reviewer'}
                    </button>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleAddHrSubmit}
                className="lg:col-span-5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-4 space-y-3"
              >
                <p className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Grant HR Staff Access
                </p>
                <div>
                  <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newHrName}
                    onChange={(e) => setNewHrName(e.target.value)}
                    placeholder="e.g. Jordan Mercer"
                    className="w-full min-h-[36px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 text-xs text-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    HR Title / Scope
                  </label>
                  <input
                    type="text"
                    required
                    value={newHrRole}
                    onChange={(e) => setNewHrRole(e.target.value)}
                    className="w-full min-h-[36px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 text-xs text-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    Work / AgentMail Email
                  </label>
                  <input
                    type="email"
                    required
                    value={newHrEmail}
                    onChange={(e) => setNewHrEmail(e.target.value)}
                    placeholder="jordan@openai.agentmail.to"
                    className="w-full min-h-[36px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 text-xs text-zinc-950 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full min-h-[38px] rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white text-xs font-semibold"
                >
                  Authorize HR Member
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
