import React, { useEffect } from 'react';
import {
  ArrowLeft,
  X,
  Scale,
  ShieldCheck,
  Briefcase,
  ArrowRight,
  Copy,
  Check,
  Printer,
  Bot,
  FileText,
} from 'lucide-react';
import {
  LegalDocTab,
  COMPANY_LEGAL_DETAILS,
  LEGAL_PART_1_SECTIONS,
  LEGAL_PART_2_SECTIONS,
  LEGAL_PART_3_SECTIONS,
  LEGAL_PART_4_PRIVACY_SECTIONS,
  EMPLOYER_FEE_SCHEDULE_ROWS,
  AI_OUTREACH_DISCLAIMER_TEXT,
  CLICKWRAP_SNIPPETS,
  LegalSectionItem,
} from '../data/legalDocuments';
import { emitToast } from '../lib/toast';

interface LegalDocumentViewProps {
  activeDoc: LegalDocTab;
  onSelectDoc: (doc: LegalDocTab) => void;
  onBack: () => void;
  onCloseToDirectory: () => void;
  onOpenPrivacyDesk?: () => void;
}

const SectionBlock: React.FC<{ section: LegalSectionItem }> = ({ section }) => (
  <section id={section.id} className="space-y-2.5 pt-5 border-t border-zinc-200 dark:border-white/[0.08] first:border-t-0 first:pt-0">
    <h3 className="font-display text-sm sm:text-base font-bold text-zinc-950 dark:text-white tracking-tight">
      {section.heading}
    </h3>
    {section.paragraphs?.map((p, idx) => (
      <p key={idx} className="text-xs sm:text-[13.5px] leading-relaxed text-zinc-700 dark:text-zinc-300">
        {p}
      </p>
    ))}
    {section.bullets && (
      <ul className="space-y-2 pt-0.5">
        {section.bullets.map((b, idx) => (
          <li
            key={idx}
            className="text-xs sm:text-[13.5px] leading-relaxed text-zinc-700 dark:text-zinc-300 flex flex-col sm:flex-row sm:gap-1.5"
          >
            <span className="font-semibold text-zinc-950 dark:text-zinc-100 shrink-0">
              {b.label}
            </span>
            <span>{b.text}</span>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export const LegalDocumentView: React.FC<LegalDocumentViewProps> = ({
  activeDoc,
  onSelectDoc,
  onBack,
  onCloseToDirectory,
  onOpenPrivacyDesk,
}) => {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const handleCopy = async (key: string, text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      emitToast(`${label} copied`, 'success');
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      emitToast('Could not copy text', 'error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-5 py-2 sm:py-4">
      {/* Top Sticky Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-white/[0.08]">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors shrink-0"
            aria-label="Back"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-lg sm:text-xl font-bold text-zinc-950 dark:text-white tracking-tight truncate">
              SWITCHZ Legal &amp; Compliance Suite
            </h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
              Operated by {COMPANY_LEGAL_DETAILS.operator} · {COMPANY_LEGAL_DETAILS.jurisdiction} · Effective{' '}
              {COMPANY_LEGAL_DETAILS.effectiveDate}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[36px] px-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button
            type="button"
            onClick={onCloseToDirectory}
            className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors"
            aria-label="Close legal view"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Document Tab Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 shadow-2xs">
          <button
            type="button"
            onClick={() => onSelectDoc('terms')}
            className={`min-h-[36px] px-3.5 rounded-lg text-xs inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeDoc === 'terms'
                ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Terms of Use</span>
            <span className="font-mono text-[10px] opacity-70">/term</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectDoc('privacy')}
            className={`min-h-[36px] px-3.5 rounded-lg text-xs inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeDoc === 'privacy'
                ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy &amp; Candidate Terms</span>
            <span className="font-mono text-[10px] opacity-70">/terms</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectDoc('employer')}
            className={`min-h-[36px] px-3.5 rounded-lg text-xs inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeDoc === 'employer'
                ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Employer Agreement &amp; Fees</span>
            <span className="font-mono text-[10px] opacity-70">/employeragreement</span>
          </button>
        </div>

        {onOpenPrivacyDesk && (
          <button
            type="button"
            onClick={onOpenPrivacyDesk}
            className="min-h-[36px] px-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-500 inline-flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Manage POPIA / GDPR Consent</span>
          </button>
        )}
      </div>

      {/* Document Body */}
      <article className="rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 p-5 sm:p-8 space-y-6 shadow-2xs">
        {activeDoc === 'terms' && (
          <>
            <header className="space-y-2 pb-4 border-b border-zinc-200 dark:border-white/[0.08]">
              <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                PART 1 · GLOBAL PLATFORM TERMS &amp; CONDITIONS · ROUTE: /term
              </p>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white tracking-tight">
                SWITCHZ Global Platform Terms &amp; Conditions
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                <span>Operator: {COMPANY_LEGAL_DETAILS.operator}</span>
                <span aria-hidden="true">·</span>
                <span>Reg. No. {COMPANY_LEGAL_DETAILS.registrationNo}</span>
                <span aria-hidden="true">·</span>
                <span>Office: {COMPANY_LEGAL_DETAILS.registeredOffice}</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed pt-1">
                Covers the SWITCHZ web applications, Progressive Web Apps (PWA), Chrome Extensions, APIs, MCP/A2A endpoints, and Poppy Protocol v1.0 manifests across all global territories.
              </p>
            </header>

            <div className="space-y-5">
              {LEGAL_PART_1_SECTIONS.map((sec) => (
                <SectionBlock key={sec.id} section={sec} />
              ))}
            </div>
          </>
        )}

        {activeDoc === 'privacy' && (
          <>
            <header className="space-y-2 pb-4 border-b border-zinc-200 dark:border-white/[0.08]">
              <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                PARTS 3 &amp; 4 · PRIVACY POLICY, COOKIE NOTICE &amp; CANDIDATE AI CONSENT · ROUTE: /terms
              </p>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white tracking-tight">
                Global Website Privacy Policy &amp; Candidate AI Privacy Consent Notice
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                <span>{COMPANY_LEGAL_DETAILS.operator} ({COMPANY_LEGAL_DETAILS.registrationNo})</span>
                <span aria-hidden="true">·</span>
                <span>Contact: {COMPANY_LEGAL_DETAILS.privacyEmail}</span>
                <span aria-hidden="true">·</span>
                <span>POPIA · GDPR · UK GDPR · EU AI Act · CCPA/CPRA</span>
              </div>
            </header>

            {/* Part 4: Website Privacy Policy */}
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white">
                  Part A: Website Privacy Policy &amp; Local Storage Notice
                </h3>
              </div>
              {LEGAL_PART_4_PRIVACY_SECTIONS.map((sec) => (
                <SectionBlock key={sec.id} section={sec} />
              ))}
            </div>

            {/* Part 3: Candidate Terms & Biometric AI Notice */}
            <div className="space-y-5 pt-6 border-t-2 border-zinc-200 dark:border-white/15">
              <div className="space-y-1">
                <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                  PART 3 · CANDIDATE TERMS OF SERVICE
                </p>
                <h3 className="font-display text-lg font-bold text-zinc-950 dark:text-white">
                  Candidate Terms of Service &amp; Global AI Privacy Consent Notice
                </h3>
              </div>
              {LEGAL_PART_3_SECTIONS.map((sec) => (
                <SectionBlock key={sec.id} section={sec} />
              ))}
            </div>

            {/* Standard AI Agent Outreach Disclaimer */}
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  Standard AI Agent Outreach Disclaimer (Appended to AgentMail &amp; Automated Proposals)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy('outreach', AI_OUTREACH_DISCLAIMER_TEXT, 'AI Outreach Disclaimer')
                  }
                  className="text-xs text-sky-700 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                >
                  {copiedKey === 'outreach' ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  Copy
                </button>
              </div>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-mono">
                {AI_OUTREACH_DISCLAIMER_TEXT}
              </p>
            </div>
          </>
        )}

        {activeDoc === 'employer' && (
          <>
            <header className="space-y-2 pb-4 border-b border-zinc-200 dark:border-white/[0.08]">
              <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                PART 2 · COMMERCIAL RECRUITMENT &amp; FEE SCHEDULE · ROUTE: /employeragreement
              </p>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white tracking-tight">
                Global Employer Master Recruitment Services Agreement &amp; Fee Schedule
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                <span>Agency: {COMPANY_LEGAL_DETAILS.operator} ({COMPANY_LEGAL_DETAILS.registrationNo})</span>
                <span aria-hidden="true">·</span>
                <span>Net 14 Payment</span>
                <span aria-hidden="true">·</span>
                <span>12-Month Ownership</span>
                <span aria-hidden="true">·</span>
                <span>90-Day Guarantee</span>
              </div>
            </header>

            <div className="space-y-5">
              {LEGAL_PART_2_SECTIONS.slice(0, 3).map((sec) => (
                <SectionBlock key={sec.id} section={sec} />
              ))}

              {/* Styled Commercial Fee Schedule Table */}
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/10">
                <table className="w-full text-left border-collapse text-xs sm:text-[13px]">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100">
                      <th className="py-3 px-3.5 font-semibold whitespace-nowrap">Tier</th>
                      <th className="py-3 px-3.5 font-semibold">Service Category</th>
                      <th className="py-3 px-3.5 font-semibold">Standard Placement Fee</th>
                      <th className="py-3 px-3.5 font-semibold">Trigger &amp; Application</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-white/[0.08]">
                    {EMPLOYER_FEE_SCHEDULE_ROWS.map((row) => (
                      <tr key={row.tier} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-950/60 align-top">
                        <td className="py-3 px-3.5 font-mono font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap tabular-nums">
                          {row.tier}
                        </td>
                        <td className="py-3 px-3.5 font-semibold text-zinc-950 dark:text-white">
                          {row.serviceCategory}
                        </td>
                        <td className="py-3 px-3.5 font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {row.feeRate}
                        </td>
                        <td className="py-3 px-3.5 text-zinc-700 dark:text-zinc-300 leading-relaxed">
                          {row.triggerAndApplication}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {LEGAL_PART_2_SECTIONS.slice(3).map((sec) => (
                <SectionBlock key={sec.id} section={sec} />
              ))}

              {/* Employer Clickwrap Standard Binding Notice */}
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Mandatory Employer Onboarding Clickwrap Declaration
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy('employer-clickwrap', CLICKWRAP_SNIPPETS.employer, 'Employer Clickwrap')
                    }
                    className="text-xs text-sky-700 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                  >
                    {copiedKey === 'employer-clickwrap' ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Copy
                  </button>
                </div>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  “{CLICKWRAP_SNIPPETS.employer}”
                </p>
              </div>
            </div>
          </>
        )}

        {/* Legal Sign-off Reminder & Navigation */}
        <footer className="pt-5 border-t border-zinc-200 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Silvernest Pty Ltd · Republic of South Africa · Placeholders ([YYYY/NNNNNN/07], [Johannesburg / Cape Town], [privacy@switchz.app]) reflect CIPC registration fields.
          </p>
          <button
            type="button"
            onClick={onCloseToDirectory}
            className="min-h-[38px] px-4 rounded-xl bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white text-xs font-semibold inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            <span>Return to SWITCHZ Directory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </footer>
      </article>
    </div>
  );
};
