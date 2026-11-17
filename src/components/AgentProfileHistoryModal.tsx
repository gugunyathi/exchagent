import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  X,
  FileText,
  Download,
  History,
  Briefcase,
  CheckCircle2,
  Mail,
  Sparkles,
  ExternalLink,
  Clock,
  ShieldCheck,
  Send,
  Loader2,
  Award,
} from 'lucide-react';
import {
  AgentDoc,
  AgentApplicationPackage,
  AgentActionHistoryEntry,
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

interface AgentProfileHistoryModalProps {
  open: boolean;
  onClose: () => void;
  agent: AgentDoc | null;
  allPersonas: AgentDoc[];
  onSelectAgent?: (agent: AgentDoc) => void;
  jobs: JobPostingDoc[];
  matches: RecruitmentMatchDoc[];
  applicationPackages: AgentApplicationPackage[];
  history: AgentActionHistoryEntry[];
  currency: CurrencyMode;
  initialPackageId?: string | null;
  onTailorAndApply?: (
    seeker: AgentDoc,
    job: JobPostingDoc,
    match?: RecruitmentMatchDoc
  ) => Promise<AgentApplicationPackage | null>;
  onLogHistory: (entry: Omit<AgentActionHistoryEntry, 'id' | 'timestamp'>) => void;
}

export const AgentProfileHistoryModal: React.FC<AgentProfileHistoryModalProps> = ({
  open,
  onClose,
  agent,
  allPersonas,
  onSelectAgent,
  jobs,
  matches,
  applicationPackages,
  history,
  currency,
  initialPackageId = null,
  onTailorAndApply,
  onLogHistory,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'docs' | 'history'>('docs');
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(initialPackageId);
  const [docSubTab, setDocSubTab] = useState<'cv' | 'cover_letter' | 'prep'>('cv');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'docs' | 'matches'>('all');
  const [tailoringJobId, setTailoringJobId] = useState<string | null>(null);
  const [sendingFollowup, setSendingFollowup] = useState(false);

  const agentPackages = useMemo(() => {
    if (!agent) return [];
    return applicationPackages
      .filter(
        (p) => p.seekerHandle === agent.handle || p.seekerAgentId === agent.id
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [agent, applicationPackages]);

  const agentHistory = useMemo(() => {
    if (!agent) return [];
    return history
      .filter((h) => h.agentHandle === agent.handle || h.agentId === agent.id)
      .filter((h) => {
        if (historyFilter === 'docs') {
          return (
            h.actionType === 'CV_UPDATED' ||
            h.actionType === 'CV_FORMATTED' ||
            h.actionType === 'COVER_LETTER_GENERATED' ||
            h.actionType === 'DOC_EXPORTED'
          );
        }
        if (historyFilter === 'matches') {
          return (
            h.actionType === 'AUTO_MATCH' ||
            h.actionType === 'APPLICATION_SUBMITTED' ||
            h.actionType === 'INTERVIEW_REQUESTED' ||
            h.actionType === 'HR_SHORTLISTED'
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [agent, history, historyFilter]);

  const agentMatches = useMemo(() => {
    if (!agent) return [];
    return matches
      .filter((m) => m.seekerHandle === agent.handle)
      .sort((a, b) => b.score - a.score);
  }, [agent, matches]);

  useEffect(() => {
    if (!open) return;
    if (initialPackageId) {
      setSelectedPkgId(initialPackageId);
      setActiveTab('docs');
    } else if (agentPackages.length > 0 && !agentPackages.some((p) => p.id === selectedPkgId)) {
      setSelectedPkgId(agentPackages[0].id);
    } else if (agentPackages.length === 0) {
      setActiveTab('overview');
    }
  }, [open, initialPackageId, agentPackages, selectedPkgId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !agent) return null;

  const selectedPkg =
    agentPackages.find((p) => p.id === selectedPkgId) || agentPackages[0] || null;

  const handleExport = async (kind: 'cv_pdf' | 'cv_docx' | 'cl_pdf' | 'cl_docx') => {
    if (!selectedPkg) return;
    let filename = '';
    if (kind === 'cv_pdf') filename = downloadCvAsPdf(selectedPkg.cvDoc);
    if (kind === 'cv_docx') filename = await downloadCvAsDocx(selectedPkg.cvDoc);
    if (kind === 'cl_pdf') filename = downloadCoverLetterAsPdf(selectedPkg.coverLetterDoc);
    if (kind === 'cl_docx') filename = await downloadCoverLetterAsDocx(selectedPkg.coverLetterDoc);

    onLogHistory({
      agentId: agent.id,
      agentHandle: agent.handle,
      actorType: 'user',
      actorName: agent.displayName,
      actionType: 'DOC_EXPORTED',
      title: `Downloaded ${kind.includes('cv') ? 'Tailored CV' : 'Cover Letter'} (${kind.endsWith('pdf') ? 'PDF' : 'DOCX'})`,
      details: `Exported ${filename} for ${selectedPkg.jobTitle} at ${selectedPkg.companyName}.`,
      relatedJobId: selectedPkg.jobId,
      relatedJobTitle: selectedPkg.jobTitle,
      relatedPackageId: selectedPkg.id,
      targetHandle: selectedPkg.companyAgentHandle,
      channel: kind.endsWith('pdf') ? 'PDF Export' : 'Word DOCX Export',
    });
    emitToast(`Downloaded ${filename}`, 'success');
  };

  const handleFollowupEmail = async () => {
    if (!selectedPkg) return;
    setSendingFollowup(true);
    try {
      await fetch('/api/agentmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inbox: agent.agentEmail,
          to:
            selectedPkg.companyAgentHandle === 'careers.openai.agent'
              ? 'careers@openai.agentmail.to'
              : 'exchagent@agentmail.to',
          subject: `Follow-up: ${selectedPkg.jobTitle} (${selectedPkg.regionZone}) — ${agent.displayName}`,
          text: `Hello ${selectedPkg.companyName} Hiring Committee,\n\nChecking in regarding my submitted tailored CV & Cover Letter package for ${selectedPkg.jobTitle} (${selectedPkg.matchScore}% Poppy fit).\n\nLooking forward to connecting,\n${agent.displayName} (${agent.handle})`,
        }),
      }).catch(() => {});

      onLogHistory({
        agentId: agent.id,
        agentHandle: agent.handle,
        actorType: 'personal_agent',
        actorName: `${agent.displayName} Personal Agent`,
        actionType: 'EMAIL_DISPATCHED',
        title: `Sent AgentMail Follow-Up to ${selectedPkg.companyName}`,
        details: `Automated polite status check transmitted from ${agent.agentEmail} for "${selectedPkg.jobTitle}".`,
        relatedJobId: selectedPkg.jobId,
        relatedJobTitle: selectedPkg.jobTitle,
        relatedPackageId: selectedPkg.id,
        targetHandle: selectedPkg.companyAgentHandle,
        channel: 'AgentMail',
      });
      emitToast(`Follow-up sent from ${agent.agentEmail}`, 'success');
    } finally {
      setSendingFollowup(false);
    }
  };

  const handleQuickTailor = async (job: JobPostingDoc, match?: RecruitmentMatchDoc) => {
    if (!onTailorAndApply) return;
    setTailoringJobId(job.id);
    try {
      const created = await onTailorAndApply(agent, job, match);
      if (created) {
        setSelectedPkgId(created.id);
        setActiveTab('docs');
        setDocSubTab('cv');
      }
    } finally {
      setTailoringJobId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/65 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl glass-panel rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 space-y-4 max-h-[92dvh] flex flex-col overflow-hidden pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="sm:hidden w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto -mt-1" />

        {/* Header: Back + Identity + Switcher + Close */}
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
                  {agent.displayName} · Personal Agent Vault
                </h2>
                {agent.verified && (
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
              </div>
              <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
                {agent.handle} · {agent.agentEmail} · {agentPackages.length} tailored dossiers · {agentHistory.length} actions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {allPersonas.length > 1 && onSelectAgent && (
              <select
                value={agent.id}
                onChange={(e) => {
                  const found = allPersonas.find((p) => p.id === e.target.value);
                  if (found) onSelectAgent(found);
                }}
                className="min-h-[34px] rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-xs text-zinc-900 dark:text-zinc-100 max-w-[170px]"
              >
                {allPersonas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
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

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/10">
            {[
              { id: 'docs' as const, label: `Submitted Docs & PDF/DOCX (${agentPackages.length})`, icon: FileText },
              { id: 'history' as const, label: `Agent Action History (${agentHistory.length})`, icon: History },
              { id: 'overview' as const, label: `Profile & Matched Roles (${agentMatches.length})`, icon: Briefcase },
            ].map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`min-h-[34px] px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    active
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
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-4">
          {/* TAB 1: SUBMITTED DOCS, VIEWER & PDF/DOCX DOWNLOAD */}
          {activeTab === 'docs' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left: Submitted Application Packages List */}
              <div className="lg:col-span-4 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Tailored Applications ({agentPackages.length})
                </p>
                {agentPackages.length === 0 ? (
                  <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-4 space-y-2.5 text-center">
                    <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                      No tailored dossiers submitted yet.
                    </p>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      Pick a matched vacancy in Profile &amp; Matched Roles to let your agent tailor your CV, draft a Cover Letter, and export PDF/DOCX.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('overview')}
                      className="min-h-[34px] px-3 rounded-lg bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 text-xs font-semibold"
                    >
                      Browse Matched Roles
                    </button>
                  </div>
                ) : (
                  agentPackages.map((pkg) => {
                    const active = selectedPkg?.id === pkg.id;
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setSelectedPkgId(pkg.id)}
                        className={`w-full text-left rounded-xl p-3 border transition-colors space-y-1 ${
                          active
                            ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-white'
                            : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                          <span className={active ? 'text-emerald-300 dark:text-emerald-700 font-semibold' : 'text-emerald-700 dark:text-emerald-400 font-semibold'}>
                            {pkg.matchScore}% Fit · {pkg.status.toUpperCase()}
                          </span>
                          <span className={active ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500'}>
                            {new Date(pkg.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="font-display text-xs font-bold leading-snug line-clamp-2">
                          {pkg.jobTitle}
                        </p>
                        <p className={`text-[11px] truncate ${active ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-600 dark:text-zinc-400'}`}>
                          {pkg.companyName} · {pkg.regionZone}
                        </p>
                        {pkg.reviewedByHr.length > 0 && (
                          <p className={`text-[10px] font-mono ${active ? 'text-sky-300 dark:text-sky-700' : 'text-sky-700 dark:text-sky-400'}`}>
                            Viewed by HR ({pkg.reviewedByHr[0].name})
                          </p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Right: Document Sheet & Export Controls */}
              <div className="lg:col-span-8">
                {selectedPkg ? (
                  <div className="rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-4 space-y-4">
                    {/* Package Header + Download Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-white/10">
                      <div className="min-w-0">
                        <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                          {selectedPkg.companyName} ({selectedPkg.companyAgentHandle}) · {selectedPkg.regionZone}
                        </p>
                        <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-white truncate">
                          {selectedPkg.jobTitle}
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleExport(docSubTab === 'cover_letter' ? 'cl_pdf' : 'cv_pdf')}
                          className="min-h-[34px] px-3 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExport(docSubTab === 'cover_letter' ? 'cl_docx' : 'cv_docx')}
                          className="min-h-[34px] px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download DOCX
                        </button>
                        <button
                          type="button"
                          disabled={sendingFollowup}
                          onClick={handleFollowupEmail}
                          className="min-h-[34px] px-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 inline-flex items-center gap-1"
                          title="Send follow-up via AgentMail"
                        >
                          {sendingFollowup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Follow-Up
                        </button>
                      </div>
                    </div>

                    {/* Sub-tabs: Tailored CV / Cover Letter / Interview Prep */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => setDocSubTab('cv')}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                            docSubTab === 'cv'
                              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-2xs'
                              : 'text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          Tailored CV
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocSubTab('cover_letter')}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                            docSubTab === 'cover_letter'
                              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-2xs'
                              : 'text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          Cover Letter
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocSubTab('prep')}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                            docSubTab === 'prep'
                              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-2xs'
                              : 'text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          AI Interview Prep ({selectedPkg.interviewPrepQuestions.length})
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                        <button
                          type="button"
                          onClick={() => handleExport('cv_pdf')}
                          className="hover:underline text-sky-700 dark:text-sky-400"
                        >
                          CV.pdf
                        </button>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() => handleExport('cv_docx')}
                          className="hover:underline text-sky-700 dark:text-sky-400"
                        >
                          CV.docx
                        </button>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() => handleExport('cl_pdf')}
                          className="hover:underline text-sky-700 dark:text-sky-400"
                        >
                          Letter.pdf
                        </button>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() => handleExport('cl_docx')}
                          className="hover:underline text-sky-700 dark:text-sky-400"
                        >
                          Letter.docx
                        </button>
                      </div>
                    </div>

                    {/* Document Canvas */}
                    {docSubTab === 'cv' && (
                      <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 p-4 space-y-4 text-xs">
                        <div className="pb-3 border-b border-zinc-200 dark:border-white/10">
                          <h4 className="font-display text-base font-bold text-zinc-950 dark:text-white">
                            {selectedPkg.cvDoc.candidateName}
                          </h4>
                          <p className="text-sky-700 dark:text-sky-400 font-semibold mt-0.5">
                            Target: {selectedPkg.cvDoc.targetRole} · {selectedPkg.cvDoc.targetCompany} ({selectedPkg.cvDoc.targetRegion})
                          </p>
                          <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mt-1">
                            {selectedPkg.cvDoc.candidateHandle} · {selectedPkg.cvDoc.email} · {selectedPkg.cvDoc.location}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[10.5px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            Tailored Executive Summary
                          </p>
                          <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed">
                            {selectedPkg.cvDoc.professionalSummary}
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-[10.5px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            ATS Specification Alignment
                          </p>
                          <p className="text-zinc-800 dark:text-zinc-200">
                            <span className="font-semibold">Competencies:</span>{' '}
                            {selectedPkg.cvDoc.coreCompetencies.join(' · ')}
                          </p>
                          {selectedPkg.cvDoc.matchedKeywords.length > 0 && (
                            <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                              Matched Spec Keywords: {selectedPkg.cvDoc.matchedKeywords.join(', ')}
                            </p>
                          )}
                          {selectedPkg.cvDoc.missingKeywords.length > 0 && (
                            <p className="text-amber-700 dark:text-amber-300">
                              Suggested Ramp Topics: {selectedPkg.cvDoc.missingKeywords.join(', ')}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2.5">
                          <p className="text-[10.5px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            Formatted Experience Highlights
                          </p>
                          {selectedPkg.cvDoc.experienceHighlights.map((exp, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-zinc-950 dark:text-white">
                                  {exp.role} — {exp.org}
                                </span>
                                <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
                                  {exp.period}
                                </span>
                              </div>
                              <ul className="list-disc pl-4 space-y-1 text-zinc-700 dark:text-zinc-300">
                                {exp.bullets.map((b, bi) => (
                                  <li key={bi}>{b}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-200 dark:border-white/10">
                          <div>
                            <p className="text-[10.5px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                              Education
                            </p>
                            {selectedPkg.cvDoc.education.map((ed, idx) => (
                              <p key={idx} className="text-zinc-700 dark:text-zinc-300">{ed}</p>
                            ))}
                          </div>
                          <div>
                            <p className="text-[10.5px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                              Credentials
                            </p>
                            {selectedPkg.cvDoc.certifications.map((c, idx) => (
                              <p key={idx} className="text-zinc-700 dark:text-zinc-300">{c}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {docSubTab === 'cover_letter' && (
                      <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 p-5 space-y-3 text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
                        <div className="pb-2 border-b border-zinc-200 dark:border-white/10 flex flex-wrap justify-between gap-2">
                          <div>
                            <p className="font-display font-bold text-sm text-zinc-950 dark:text-white">
                              {selectedPkg.coverLetterDoc.signatureName}
                            </p>
                            <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                              {selectedPkg.coverLetterDoc.signatureContact}
                            </p>
                          </div>
                          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                            {selectedPkg.coverLetterDoc.date}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {selectedPkg.coverLetterDoc.recipientName}
                          </p>
                          <p>
                            {selectedPkg.coverLetterDoc.recipientTitle} · {selectedPkg.coverLetterDoc.companyName}
                          </p>
                        </div>
                        <p className="font-semibold text-sky-700 dark:text-sky-400">
                          RE: {selectedPkg.coverLetterDoc.subject}
                        </p>
                        <p>{selectedPkg.coverLetterDoc.greeting}</p>
                        <p>{selectedPkg.coverLetterDoc.openingParagraph}</p>
                        {selectedPkg.coverLetterDoc.bodyParagraphs.map((para, idx) => (
                          <p key={idx}>{para}</p>
                        ))}
                        <p>{selectedPkg.coverLetterDoc.closingParagraph}</p>
                        <div className="pt-2">
                          <p>Sincerely,</p>
                          <p className="font-bold text-zinc-950 dark:text-white mt-1">
                            {selectedPkg.coverLetterDoc.signatureName}
                          </p>
                        </div>
                      </div>
                    )}

                    {docSubTab === 'prep' && (
                      <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-950 dark:text-white">
                          <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span>Role-Specific AI Interview Prep Brief</span>
                        </div>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                          Generated from {selectedPkg.companyName}’s exact vacancy specification and your tailored CV highlights:
                        </p>
                        <div className="space-y-2">
                          {selectedPkg.interviewPrepQuestions.map((q, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-3 text-xs text-zinc-800 dark:text-zinc-200"
                            >
                              <span className="font-mono font-bold text-sky-700 dark:text-sky-400 mr-2">
                                Q{idx + 1}.
                              </span>
                              {q}
                            </div>
                          ))}
                        </div>

                        {selectedPkg.hrNotes.length > 0 && (
                          <div className="pt-2 border-t border-zinc-200 dark:border-white/10 space-y-2">
                            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                              Latest HR Committee Status &amp; Feedback
                            </p>
                            {selectedPkg.hrNotes.map((n) => (
                              <div key={n.id} className="rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/20 p-2.5 text-xs">
                                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                                  {n.authorName} · {n.authorRole}
                                </p>
                                <p className="text-zinc-700 dark:text-zinc-300 mt-0.5">{n.note}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* TAB 2: COMPLETE AGENT ACTION HISTORY TIMELINE */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Full Audit &amp; Action Timeline for {agent.handle}
                </p>
                <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10">
                  {[
                    { id: 'all' as const, label: 'All Actions' },
                    { id: 'docs' as const, label: 'CV & Cover Letters' },
                    { id: 'matches' as const, label: 'Matches & HR' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setHistoryFilter(f.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${
                        historyFilter === f.id
                          ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                          : 'text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {agentHistory.length === 0 ? (
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-6 text-center text-xs text-zinc-600 dark:text-zinc-400">
                  No logged actions yet for this filter. Match a role or download a PDF/DOCX to record activity.
                </div>
              ) : (
                <div className="space-y-2">
                  {agentHistory.map((item) => {
                    const linkedPkg = item.relatedPackageId
                      ? applicationPackages.find((p) => p.id === item.relatedPackageId)
                      : undefined;
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                            <span className="font-semibold text-sky-700 dark:text-sky-400">
                              {item.actionType}
                            </span>
                            <span>·</span>
                            <span>{item.actorName}</span>
                            {item.channel && (
                              <>
                                <span>·</span>
                                <span>{item.channel}</span>
                              </>
                            )}
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Clock className="w-3 h-3" />
                              {new Date(item.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="font-display text-xs sm:text-sm font-bold text-zinc-950 dark:text-white">
                            {item.title}
                          </p>
                          <p className="text-xs text-zinc-700 dark:text-zinc-300">
                            {item.details}
                          </p>
                        </div>

                        {linkedPkg && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPkgId(linkedPkg.id);
                              setActiveTab('docs');
                            }}
                            className="min-h-[32px] px-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-900 dark:text-zinc-100 hover:border-zinc-500 shrink-0 inline-flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View Docs
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PROFILE & MATCHED ROLES WITH 1-CLICK TAILOR + APPLY */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="md:col-span-2 space-y-1.5">
                  <p className="font-display font-bold text-sm text-zinc-950 dark:text-white">
                    {agent.cvSummary?.headline || agent.roleTitle}
                  </p>
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {agent.cvSummary?.rawCvExcerpt || agent.summary}
                  </p>
                  <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                    Skills: {(agent.cvSummary?.parsedSkills || agent.skills).join(' · ')}
                  </p>
                </div>
                <div className="space-y-1.5 md:border-l md:border-zinc-200 md:dark:border-white/10 md:pl-4">
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">AgentMail Inbox</p>
                  <p className="font-mono font-semibold text-zinc-950 dark:text-white truncate">
                    {agent.agentEmail}
                  </p>
                  {agent.linkedinUrl && (
                    <a
                      href={`https://${agent.linkedinUrl.replace(/^https?:\/\//, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-400 hover:underline font-mono text-[11px]"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {agent.linkedinUrl}
                    </a>
                  )}
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 tabular-nums pt-1">
                    Min Target: {formatMoney(agent.cvSummary?.salaryMinZAR || 85000, currency)}/mo
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Matched Roles &amp; OpenAI Global Opportunities
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    1-Click updates CV to job specs, writes Cover Letter &amp; submits
                  </span>
                </div>

                {(agentMatches.length > 0
                  ? agentMatches.map((m) => ({
                      job: jobs.find((j) => j.id === m.jobId),
                      match: m,
                    }))
                  : jobs.slice(0, 8).map((job) => ({ job, match: undefined }))
                )
                  .filter((row): row is { job: JobPostingDoc; match: RecruitmentMatchDoc | undefined } => Boolean(row.job))
                  .map(({ job, match }) => {
                    const existingPkg = agentPackages.find((p) => p.jobId === job.id);
                    const isTailoring = tailoringJobId === job.id;
                    return (
                      <div
                        key={job.id}
                        className="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {job.companyName}
                            </span>
                            <span>·</span>
                            <span>{job.regionZone || job.location}</span>
                            {match && (
                              <>
                                <span>·</span>
                                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                  {match.score}% Fit
                                </span>
                              </>
                            )}
                          </div>
                          <p className="font-display text-xs sm:text-sm font-bold text-zinc-950 dark:text-white truncate">
                            {job.title}
                          </p>
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 tabular-nums">
                            {formatMoney(job.salaryRangeZAR[0], currency)}–{formatMoney(job.salaryRangeZAR[1], currency)}/mo · {job.requiredSkills.slice(0, 3).join(', ')}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {existingPkg ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPkgId(existingPkg.id);
                                setActiveTab('docs');
                              }}
                              className="min-h-[34px] px-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 dark:bg-emerald-500/15 dark:border-emerald-400/30 dark:text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              View Docs &amp; PDF
                            </button>
                          ) : (
                            onTailorAndApply && (
                              <button
                                type="button"
                                disabled={isTailoring}
                                onClick={() => handleQuickTailor(job, match)}
                                className="min-h-[34px] px-3 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
                              >
                                {isTailoring ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3.5 h-3.5" />
                                )}
                                {isTailoring ? 'Tailoring...' : 'Tailor CV & Apply'}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
