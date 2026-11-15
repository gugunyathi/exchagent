import React, { useState } from 'react';
import {
  Calendar,
  Mail,
  Send,
  Download,
  CheckCircle2,
  ShieldCheck,
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
  const [subTab, setSubTab] = useState<'mail' | 'calendar'>(
    preselectedEmailTarget ? 'mail' : 'mail'
  );

  // Agentic Mail Composer
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
  const [statusNote, setStatusNote] = useState<string | null>(null);

  React.useEffect(() => {
    if (preselectedEmailTarget) {
      setToAddress(preselectedEmailTarget.agentEmail);
      setSubTab('mail');
    }
  }, [preselectedEmailTarget]);

  const executeEmailSendAndTriage = async (alsoSendGmail: boolean) => {
    setTriaging(true);
    setStatusNote(null);
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
        setStatusNote(
          `Target agent classified pitch as ${data.aiClassification}, replied autonomously, and scheduled a Calendar meeting.`
        );
      } else {
        setStatusNote(`Target agent classified email as ${data.aiClassification} and sent autonomous reply.`);
      }
    } finally {
      setTriaging(false);
    }
  };

  const handleConfirmGoogleCalendarSync = async (booking: BookingDoc) => {
    setPendingCalendarBooking(null);
    const res = await insertGoogleCalendarEvent(booking);
    if (res.synced) {
      setStatusNote(`Synced "${booking.title}" to your live Google Calendar with Google Meet.`);
    } else {
      setStatusNote(res.error || 'Saved in Switchboard Simulated Calendar Engine.');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header & Workspace OAuth Connect */}
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-cyan-400">
            @switchboard.agent · Calendar Sync
          </p>
          <h2 className="text-base sm:text-lg font-semibold text-white mt-0.5">
            Mail &amp; Calendar Bookings
          </h2>
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
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              Google Workspace Live Connected
            </span>
          )}

          <SwipeScrollArea
            direction="horizontal"
            innerClassName="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-950/75 border border-slate-800"
          >
            <button
              type="button"
              onClick={() => setSubTab('mail')}
              className={`min-h-[38px] px-3 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 ${
                subTab === 'mail'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Agentic Inbox ({emails.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('calendar')}
              className={`min-h-[38px] px-3 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 ${
                subTab === 'calendar'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Bookings ({bookings.length})
            </button>
          </SwipeScrollArea>
        </div>
      </div>

      {statusNote && (
        <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/30 p-3.5 text-xs text-emerald-200 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>{statusNote}</span>
        </div>
      )}

      {subTab === 'mail' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
          {/* Compose & Test Pitch */}
          <div className="lg:col-span-5 glass-panel rounded-2xl p-3.5 sm:p-5 space-y-3.5">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-cyan-400" />
              Compose &amp; Pitch via Agentic Email
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">From Address</label>
              <input
                type="text"
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3.5 py-2 text-xs font-mono text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">To Agent Email</label>
              <select
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3.5 py-2.5 text-xs font-mono text-cyan-200"
              >
                {nonEmergency.map((a) => (
                  <option key={a.id} value={a.agentEmail}>
                    {a.agentEmail} ({a.organization})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3.5 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Pitch Body</label>
              <textarea
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3.5 py-2 text-sm text-slate-200"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={triaging}
                onClick={() => executeEmailSendAndTriage(false)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {triaging ? 'Running Gemini Triage...' : 'Send via @switchboard.agent'}
              </button>

              {workspaceToken && (
                <button
                  type="button"
                  disabled={triaging}
                  onClick={() => setPendingGmailSend(true)}
                  className="rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-xs font-medium text-slate-200 hover:border-emerald-400"
                >
                  Also Send via Gmail
                </button>
              )}
            </div>
          </div>

          {/* Autonomous Inbox Threads (Tap to Expand) */}
          <div className="lg:col-span-7 glass-panel rounded-2xl p-3.5 sm:p-4 space-y-3">
            <h3 className="text-sm sm:text-base font-semibold text-white">Inbox Threads</h3>
            <div className="space-y-2.5">
              {emails.map((mail) => {
                const isExpanded = expandedEmailId === mail.id;
                return (
                  <div
                    key={mail.id}
                    onClick={() => setExpandedEmailId(isExpanded ? null : mail.id)}
                    className="rounded-xl bg-slate-950/65 border border-slate-800/90 p-3.5 space-y-2 cursor-pointer hover:border-slate-700 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-mono text-cyan-300 truncate max-w-full">
                        {mail.fromAddress} → {mail.toAddress}
                      </span>
                      <span className="font-mono text-emerald-400 shrink-0">{mail.aiClassification}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-white">{mail.subject}</h4>
                    <p className={`text-xs text-slate-400 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                      {mail.body}
                    </p>
                    {isExpanded && mail.replyBody && (
                      <div className="rounded-lg bg-emerald-950/25 border border-emerald-500/25 p-3 text-xs text-emerald-100 leading-relaxed">
                        <span className="font-mono text-emerald-400 block mb-1">
                          Agent Reply:
                        </span>
                        {mail.replyBody}
                      </div>
                    )}
                    {!isExpanded && mail.replyBody && (
                      <p className="text-xs text-cyan-300 font-medium">Tap to view agent reply</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Booked Meetings Timeline */
        <div className="glass-panel rounded-2xl p-3.5 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                A2A Scheduled Calls &amp; Guardrail Timeline
              </h3>
              <span className="text-xs text-slate-400">
                15m buffer · 08:00–17:00 SAST · Google, Outlook &amp; .ics Schedule Sync
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => downloadScheduleIcs(bookings)}
                className="min-h-[36px] inline-flex items-center gap-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-cyan-200 hover:border-cyan-400 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Schedule (.ics)
              </button>
              <button
                type="button"
                onClick={() => downloadScheduleCsv(bookings)}
                className="min-h-[36px] inline-flex items-center gap-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-emerald-200 hover:border-emerald-400 whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Agenda (.csv)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="rounded-xl bg-slate-950/65 border border-slate-800 p-3.5 sm:p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-mono text-cyan-300 truncate">
                    {b.organizerHandle} ↔ {b.attendeeHandle}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {b.interviewMode === 'live_video' && (
                      <span className="inline-flex items-center gap-1 rounded bg-cyan-500/15 border border-cyan-400/30 px-1.5 py-0.5 text-[10px] font-mono text-cyan-200">
                        <Video className="w-3 h-3" />
                        LIVE VIDEO
                      </span>
                    )}
                    <span className="font-mono tabular-nums text-emerald-300">
                      {formatMoney(b.dealValueZAR, currency)}
                    </span>
                  </div>
                </div>
                <h4 className="text-sm font-semibold text-white">{b.title}</h4>
                <p className="text-xs font-mono text-slate-400 tabular-nums">
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

                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <a
                    href={b.meetLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-mono text-cyan-300 hover:underline truncate max-w-full"
                  >
                    <span className="truncate">{b.meetLink.replace('https://', '')}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>

                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
                    <a
                      href={buildGoogleCalendarUrl(b)}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[34px] rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1 text-[11px] text-slate-200 hover:border-cyan-400 inline-flex items-center justify-center"
                    >
                      Google Web
                    </a>
                    <a
                      href={buildOutlookCalendarUrl(b)}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[34px] rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1 text-[11px] text-slate-200 hover:border-sky-400 inline-flex items-center justify-center"
                    >
                      Outlook
                    </a>
                    <a
                      href={buildOffice365CalendarUrl(b)}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[34px] rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1 text-[11px] text-slate-200 hover:border-sky-400 inline-flex items-center justify-center"
                    >
                      365
                    </a>
                    <button
                      type="button"
                      onClick={() => downloadIcsFile(b)}
                      className="min-h-[34px] inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1 text-[11px] text-slate-200 hover:border-cyan-400"
                    >
                      <Download className="w-3 h-3" />
                      .ics
                    </button>
                    {workspaceToken && !b.googleSynced && (
                      <button
                        type="button"
                        onClick={() => setPendingCalendarBooking(b)}
                        className="col-span-2 sm:col-span-1 min-h-[34px] rounded-lg bg-emerald-400 px-2.5 py-1 text-[11px] font-semibold text-slate-950 hover:bg-emerald-300"
                      >
                        Sync to Google Cal
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl glass-panel p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Confirm Sending Email via Gmail</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will send a live email from your connected Gmail account to{' '}
              <span className="font-mono text-cyan-300">{toAddress}</span> with subject{' '}
              <strong>&quot;{subject}&quot;</strong>.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingGmailSend(false)}
                className="min-h-[40px] rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeEmailSendAndTriage(true)}
                className="min-h-[40px] rounded-lg bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300"
              >
                Confirm &amp; Send Gmail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory User Confirmation Dialog before mutating Google Calendar */}
      {pendingCalendarBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl glass-panel p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Confirm Google Calendar Event Creation</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Insert event <strong>&quot;{pendingCalendarBooking.title}&quot;</strong> into your primary Google Calendar for{' '}
              <span className="font-mono text-cyan-300">
                {new Date(pendingCalendarBooking.startTime).toLocaleString('en-ZA')}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingCalendarBooking(null)}
                className="min-h-[40px] rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmGoogleCalendarSync(pendingCalendarBooking)}
                className="min-h-[40px] rounded-lg bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300"
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
