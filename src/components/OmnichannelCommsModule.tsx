import React, { useState } from 'react';
import {
  Calendar,
  Mail,
  Send,
  Download,
  CheckCircle2,
  ExternalLink,
  Video,
  FileSpreadsheet,
} from 'lucide-react';
import {
  AgentDoc,
  BookingDoc,
  AgentEmailDoc,
  CurrencyMode,
  formatMoney,
} from '../types/firestore';
import {
  downloadIcsFile,
  downloadScheduleIcs,
  downloadScheduleCsv,
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
  buildOffice365CalendarUrl,
  insertGoogleCalendarEvent,
  evaluateCalendarGuardrails,
} from '../services/calendarAgentTool';
import { sendEmailViaGmailApi } from '../services/gmailAgentBridge';
import { SwipeScrollArea } from './SwipeScrollArea';
import { emitToast } from '../lib/toast';

interface OmnichannelCommsModuleProps {
  agents: AgentDoc[];
  bookings: BookingDoc[];
  emails: AgentEmailDoc[];
  preselectedEmailTarget: AgentDoc | null;
  workspaceToken: string | null;
  currency: CurrencyMode;
  ownerUid: string;
  onAddBooking: (booking: BookingDoc) => Promise<void>;
  onAddEmail: (email: AgentEmailDoc) => Promise<void>;
  onConnectGoogle: () => Promise<unknown>;
}

export const OmnichannelCommsModule: React.FC<OmnichannelCommsModuleProps> = ({
  agents,
  bookings,
  emails,
  preselectedEmailTarget,
  workspaceToken,
  currency,
  ownerUid,
  onAddBooking,
  onAddEmail,
  onConnectGoogle,
}) => {
  const nonEmergency = agents.filter((a) => a.handle !== '911.emergency.agent');
  const [subTab, setSubTab] = useState<'mail' | 'calendar'>('mail');

  const [toAddress, setToAddress] = useState(
    preselectedEmailTarget?.agentEmail || nonEmergency[0]?.agentEmail || 'pitch@ceo.woolworths.agent'
  );
  const [fromAddress, setFromAddress] = useState('alex.founder@switchboard.agent');
  const [subject, setSubject] = useState('Partnership Proposal: Sandton Cold-Chain & Solar Telemetry');
  const [body, setBody] = useState(
    'Hello — We can deploy 12 autonomous IoT cold-chain units for R85,000 total (18% below standard rate) with x402 Base settlement and full POPIA audit trails.'
  );
  const [triaging, setTriaging] = useState(false);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(emails[0]?.id || null);
  const [pendingGmailSend, setPendingGmailSend] = useState(false);
  const [pendingCalendarBooking, setPendingCalendarBooking] = useState<BookingDoc | null>(null);

  React.useEffect(() => {
    if (preselectedEmailTarget) {
      setToAddress(preselectedEmailTarget.agentEmail);
      setSubTab('mail');
    }
  }, [preselectedEmailTarget]);

  const executeEmailSendAndTriage = async (alsoSendGmail: boolean) => {
    setTriaging(true);
    setPendingGmailSend(false);
    try {
      if (alsoSendGmail && workspaceToken) {
        await sendEmailViaGmailApi({ to: toAddress, subject, body });
      }

      const targetAgent =
        agents.find((a) => a.agentEmail === toAddress) || nonEmergency[0];

      const res = await fetch('/api/email/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAddress,
          toAddress,
          subject,
          body,
          targetMinDiscountPct: targetAgent?.guardrails.minDiscountPct ?? 12,
          minExecMeetingValueZAR: targetAgent?.guardrails.minExecMeetingValueZAR ?? 10000,
        }),
      });
      const data = await res.json();

      const newEmail: AgentEmailDoc = {
        id: `mail_${Date.now()}`,
        fromAddress,
        toAddress,
        subject,
        body,
        replyBody: data.replyBody,
        threadId: `thr_${Date.now()}`,
        ownerUid,
        aiClassification: data.aiClassification || 'QUALIFIED_PITCH',
        autoReplied: true,
        proposedPriceZAR: data.proposedPriceZAR || 0,
        timestamp: new Date().toISOString(),
      };
      await onAddEmail(newEmail);

      if (data.shouldBookMeeting && targetAgent) {
        const slot = evaluateCalendarGuardrails(targetAgent, data.proposedPriceZAR || 45000);
        await onAddBooking({
          id: `book_${Date.now()}`,
          organizerAgentId: 'agent_alex_founder',
          organizerHandle: 'alex.founder.agent',
          attendeeAgentId: targetAgent.id,
          attendeeHandle: targetAgent.handle,
          ownerUid,
          title: `Follow-up: ${subject.slice(0, 56)}`,
          startTime: slot.suggestedStartISO,
          endTime: slot.suggestedEndISO,
          meetLink: `https://meet.google.com/swb-${Math.random().toString(36).slice(2, 6)}-cal`,
          dealValueZAR: data.proposedPriceZAR || 45000,
          googleSynced: false,
          status: 'CONFIRMED',
        });
        emitToast(`${data.aiClassification}: Replied & booked calendar slot`, 'success');
      } else {
        emitToast(`Triaged as ${data.aiClassification} & replied`, 'success');
      }
    } finally {
      setTriaging(false);
    }
  };

  const handleConfirmGoogleCalendarSync = async (booking: BookingDoc) => {
    setPendingCalendarBooking(null);
    const res = await insertGoogleCalendarEvent(booking);
    if (res.synced) {
      emitToast(`Synced "${booking.title}" to Google Calendar`, 'success');
    } else {
      emitToast(res.error || 'Saved in local calendar engine', 'info');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Workspace OAuth Connect */}
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-display font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
            Mail &amp; Calendar
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Autonomous @switchboard.agent triage &amp; calendar booking
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!workspaceToken ? (
            <button onClick={() => onConnectGoogle()} className="gsi-material-button">
              <div className="gsi-material-button-state" />
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg viewBox="0 0 48 48" style={{ display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">Connect Google Calendar &amp; Gmail</span>
              </div>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              Google Workspace Connected
            </span>
          )}

          <SwipeScrollArea
            direction="horizontal"
            innerClassName="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10"
          >
            <button
              type="button"
              onClick={() => setSubTab('mail')}
              className={`min-h-[36px] px-3 rounded-lg text-xs whitespace-nowrap shrink-0 transition-colors ${
                subTab === 'mail'
                  ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white font-medium'
              }`}
            >
              Inbox ({emails.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('calendar')}
              className={`min-h-[36px] px-3 rounded-lg text-xs whitespace-nowrap shrink-0 transition-colors ${
                subTab === 'calendar'
                  ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white font-medium'
              }`}
            >
              Bookings ({bookings.length})
            </button>
          </SwipeScrollArea>
        </div>
      </div>

      {subTab === 'mail' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Compose Pitch */}
          <div className="lg:col-span-5 glass-panel rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
              <Mail className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              Agentic Pitch Mail
            </h3>

            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              From
              <input
                type="text"
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                className="mt-1 w-full rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs font-mono text-zinc-950 dark:text-zinc-200 focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
              />
            </label>

            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              To
              <select
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                className="mt-1 w-full rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
              >
                {nonEmergency.map((a) => (
                  <option key={a.id} value={a.agentEmail}>
                    {a.agentEmail} ({a.organization})
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Subject
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
              />
            </label>

            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Message
              <textarea
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="mt-1 w-full rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-950 dark:text-zinc-200 focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
              />
            </label>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={triaging}
                onClick={() => executeEmailSendAndTriage(false)}
                className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-950 dark:bg-zinc-50 px-4 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                {triaging ? 'Triaging...' : 'Send & Triage'}
              </button>

              {workspaceToken && (
                <button
                  type="button"
                  disabled={triaging}
                  onClick={() => setPendingGmailSend(true)}
                  className="min-h-[38px] rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25 transition-colors"
                >
                  Send via Gmail
                </button>
              )}
            </div>
          </div>

          {/* Inbox Threads */}
          <div className="lg:col-span-7 glass-panel rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50">Inbox Threads</h3>
            <div className="space-y-2.5">
              {emails.map((mail) => {
                const isExpanded = expandedEmailId === mail.id;
                return (
                  <div
                    key={mail.id}
                    onClick={() => setExpandedEmailId(isExpanded ? null : mail.id)}
                    className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3.5 space-y-2 cursor-pointer hover:border-zinc-400 dark:hover:border-white/25 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-mono text-zinc-600 dark:text-zinc-400 truncate max-w-full">
                        {mail.fromAddress} → {mail.toAddress}
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                        {mail.aiClassification}
                      </span>
                    </div>
                    <h4 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-100">{mail.subject}</h4>
                    <p className={`text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                      {mail.body}
                    </p>
                    {isExpanded && mail.replyBody && (
                      <div className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/10 p-3 text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
                        <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 block mb-1">
                          Autonomous Reply:
                        </span>
                        {mail.replyBody}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Bookings Grid */
        <div className="glass-panel rounded-2xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Scheduled Calls
              </h3>
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                15m buffer · 08:00–17:00 SAST
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  downloadScheduleIcs(bookings);
                  emitToast('Downloaded schedule.ics', 'success');
                }}
                className="min-h-[34px] inline-flex items-center gap-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                .ics
              </button>
              <button
                type="button"
                onClick={() => {
                  downloadScheduleCsv(bookings);
                  emitToast('Downloaded agenda.csv', 'success');
                }}
                className="min-h-[34px] inline-flex items-center gap-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25 whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                .csv
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-mono text-zinc-600 dark:text-zinc-400 truncate">
                    {b.organizerHandle} ↔ {b.attendeeHandle}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {b.interviewMode === 'live_video' && (
                      <span className="inline-flex items-center gap-1 rounded bg-sky-50 dark:bg-zinc-900 border border-sky-300 dark:border-white/15 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-sky-700 dark:text-sky-300">
                        <Video className="w-3 h-3" />
                        VIDEO
                      </span>
                    )}
                    <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">
                      {formatMoney(b.dealValueZAR, currency)}
                    </span>
                  </div>
                </div>
                <h4 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-100">{b.title}</h4>
                <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 tabular-nums">
                  {new Date(b.startTime).toLocaleString('en-ZA', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  –{' '}
                  {new Date(b.endTime).toLocaleTimeString('en-ZA', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  SAST
                </p>

                <div className="pt-2 border-t border-zinc-200 dark:border-white/10 space-y-2">
                  <a
                    href={b.meetLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-mono text-sky-700 dark:text-sky-400 hover:underline truncate max-w-full"
                  >
                    <span className="truncate">{b.meetLink.replace('https://', '')}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>

                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
                    <a
                      href={buildGoogleCalendarUrl(b)}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[32px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:text-white inline-flex items-center justify-center"
                    >
                      Google
                    </a>
                    <a
                      href={buildOutlookCalendarUrl(b)}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[32px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:text-white inline-flex items-center justify-center"
                    >
                      Outlook
                    </a>
                    <a
                      href={buildOffice365CalendarUrl(b)}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[32px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:text-white inline-flex items-center justify-center"
                    >
                      365
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        downloadIcsFile(b);
                        emitToast('Downloaded .ics invite', 'success');
                      }}
                      className="min-h-[32px] inline-flex items-center justify-center gap-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:border-zinc-400"
                    >
                      <Download className="w-3 h-3" />
                      .ics
                    </button>
                    {workspaceToken && !b.googleSynced && (
                      <button
                        type="button"
                        onClick={() => setPendingCalendarBooking(b)}
                        className="col-span-2 sm:col-span-1 min-h-[32px] rounded-lg bg-zinc-950 dark:bg-zinc-50 px-2.5 text-[11px] font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white"
                      >
                        Sync to Google
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mandatory User Confirmation Dialog before mutating Gmail */}
      {pendingGmailSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 dark:bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0c0c0f] border border-zinc-300 dark:border-white/15 p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-display font-bold text-zinc-950 dark:text-zinc-50">Confirm Sending Email via Gmail</h3>
            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
              This will send a live email from your connected Gmail account to{' '}
              <span className="font-mono text-sky-700 dark:text-sky-400">{toAddress}</span> with subject{' '}
              <strong>&quot;{subject}&quot;</strong>.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingGmailSend(false)}
                className="min-h-[38px] rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-zinc-900 px-4 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeEmailSendAndTriage(true)}
                className="min-h-[38px] rounded-lg bg-zinc-950 dark:bg-zinc-50 px-4 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white"
              >
                Confirm &amp; Send Gmail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory User Confirmation Dialog before mutating Google Calendar */}
      {pendingCalendarBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 dark:bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0c0c0f] border border-zinc-300 dark:border-white/15 p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-display font-bold text-zinc-950 dark:text-zinc-50">Confirm Google Calendar Event Creation</h3>
            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
              Insert event <strong>&quot;{pendingCalendarBooking.title}&quot;</strong> into your primary Google Calendar for{' '}
              <span className="font-mono text-sky-700 dark:text-sky-400">
                {new Date(pendingCalendarBooking.startTime).toLocaleString('en-ZA')}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingCalendarBooking(null)}
                className="min-h-[38px] rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-zinc-900 px-4 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmGoogleCalendarSync(pendingCalendarBooking)}
                className="min-h-[38px] rounded-lg bg-zinc-950 dark:bg-zinc-50 px-4 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white"
              >
                Create Calendar Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
