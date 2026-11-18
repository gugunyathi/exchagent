import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Mail,
  Inbox,
  Send,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Reply,
  Bot,
  ArrowLeft,
  X,
  Plus,
  Copy,
  Check,
} from 'lucide-react';
import { AgentDoc, CurrencyMode, formatMoney } from '../types/firestore';
import { SwipeScrollArea } from './SwipeScrollArea';
import { emitToast } from '../lib/toast';

interface AgentMailInboxSummary {
  inbox_id: string;
  email: string;
  display_name?: string;
  status?: string;
  created_at?: string;
}

interface AgentMailMessage {
  id: string;
  message_id?: string;
  thread_id?: string;
  from: string;
  to: string;
  subject: string;
  snippet?: string;
  text?: string;
  html?: string;
  timestamp: string;
  unread?: boolean;
}

interface TriageResult {
  aiClassification: string;
  proposedPriceZAR?: number;
  shouldBookMeeting?: boolean;
  replyBody: string;
}

interface AgentMailInboxModuleProps {
  agents: AgentDoc[];
  onUpdateAgent: (agent: AgentDoc) => Promise<void>;
  currency: CurrencyMode;
  ownerUid: string;
}

function safeFormatTime(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return 'Recent';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function safeFormatDateTime(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return 'Unknown time';
  return d.toLocaleString();
}

export const AgentMailInboxModule: React.FC<AgentMailInboxModuleProps> = ({
  agents,
  onUpdateAgent,
  currency,
}) => {
  const [loading, setLoading] = useState(true);
  const [loadingMsgDetail, setLoadingMsgDetail] = useState(false);
  const [inboxes, setInboxes] = useState<AgentMailInboxSummary[]>([
    { inbox_id: 'exchagent@agentmail.to', email: 'exchagent@agentmail.to', display_name: 'Switchboard Primary' },
  ]);
  const [activeInboxEmail, setActiveInboxEmail] = useState('exchagent@agentmail.to');
  const [configured, setConfigured] = useState(false);
  const [keyScope, setKeyScope] = useState<'organization' | 'inbox_scoped' | 'sandbox'>('sandbox');
  const [totalParentCount, setTotalParentCount] = useState<number | null>(null);
  const [messages, setMessages] = useState<AgentMailMessage[]>([]);
  const [selectedMsg, setSelectedMsg] = useState<AgentMailMessage | null>(null);

  // Agent provisioning state
  const [provisioningHandle, setProvisioningHandle] = useState<string | null>(null);
  const [provisioningAll, setProvisioningAll] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Compose / Reply State
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [toField, setToField] = useState('');
  const [subjectField, setSubjectField] = useState('');
  const [textField, setTextField] = useState('');
  const [sending, setSending] = useState(false);

  // AI Triage State
  const [triagingId, setTriagingId] = useState<string | null>(null);
  const [triageResults, setTriageResults] = useState<Record<string, TriageResult>>({});
  const [sendingAiReplyId, setSendingAiReplyId] = useState<string | null>(null);

  const nonEmergencyAgents = useMemo(
    () => agents.filter((a) => a.handle !== '911.emergency.agent'),
    [agents]
  );

  const fetchInboxes = useCallback(async () => {
    try {
      const res = await fetch('/api/agentmail/inboxes');
      if (!res.ok) return;
      const data = await res.json();
      setConfigured(Boolean(data.configured));
      if (data.scope === 'organization' || data.scope === 'inbox_scoped' || data.scope === 'sandbox') {
        setKeyScope(data.scope);
      }
      if (Array.isArray(data.inboxes) && data.inboxes.length > 0) {
        setInboxes(data.inboxes);
      }
    } catch {
      // keep existing list
    }
  }, []);

  const fetchInboxMessages = useCallback(async (targetInbox: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agentmail/inbox?inbox=${encodeURIComponent(targetInbox)}`);
      if (res.ok) {
        const data = await res.json();
        setConfigured(Boolean(data.configured));
        setTotalParentCount(
          typeof data.totalParentCount === 'number' ? data.totalParentCount : null
        );
        const list: AgentMailMessage[] = Array.isArray(data.messages) ? data.messages : [];
        setMessages(list);
        setSelectedMsg(list[0] || null);
      } else {
        setMessages([]);
        setSelectedMsg(null);
      }
    } catch (err) {
      console.warn('Failed to load AgentMail inbox:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInboxes();
  }, [fetchInboxes]);

  useEffect(() => {
    fetchInboxMessages(activeInboxEmail);
  }, [activeInboxEmail, fetchInboxMessages]);

  useEffect(() => {
    if (!composeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setComposeOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [composeOpen]);

  const handleSelectMessage = async (msg: AgentMailMessage) => {
    setSelectedMsg(msg);
    if (!configured || !msg.id || msg.id.startsWith('msg_mock_')) return;
    setLoadingMsgDetail(true);
    try {
      const res = await fetch(
        `/api/agentmail/message?inbox=${encodeURIComponent(activeInboxEmail)}&messageId=${encodeURIComponent(
          msg.id
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.message) {
          setSelectedMsg(data.message);
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? data.message : m)));
        }
      }
    } catch {
      // keep list summary
    } finally {
      setLoadingMsgDetail(false);
    }
  };

  const handleProvisionAgentInbox = async (agent: AgentDoc) => {
    setProvisioningHandle(agent.handle);
    try {
      const res = await fetch('/api/agentmail/inboxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: agent.handle,
          displayName: agent.displayName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.inbox?.email) {
        emitToast(data?.details || data?.error || `Could not provision email for ${agent.handle}`, 'warning');
        return null;
      }

      const provisionedEmail = String(data.inbox.email);
      await onUpdateAgent({ ...agent, agentEmail: provisionedEmail, gmailBridgeEnabled: true });
      setInboxes((prev) => {
        if (prev.some((i) => i.email.toLowerCase() === provisionedEmail.toLowerCase())) return prev;
        return [data.inbox, ...prev];
      });
      setActiveInboxEmail(provisionedEmail);
      emitToast(`${agent.displayName} now uses ${provisionedEmail}`, 'success');
      return provisionedEmail;
    } catch {
      emitToast(`Network error provisioning email for ${agent.handle}`, 'warning');
      return null;
    } finally {
      setProvisioningHandle(null);
    }
  };

  const handleProvisionAllAgents = async () => {
    const candidates = nonEmergencyAgents.filter(
      (a) => !a.agentEmail.toLowerCase().endsWith('@agentmail.to')
    );
    if (candidates.length === 0) {
      emitToast('All AI agents already have live @agentmail.to addresses', 'info');
      return;
    }
    setProvisioningAll(true);
    let createdCount = 0;
    try {
      for (const agent of candidates) {
        const email = await handleProvisionAgentInbox(agent);
        if (email) createdCount += 1;
      }
      await fetchInboxes();
      emitToast(`Assigned @agentmail.to email to ${createdCount} AI agent(s)`, 'success');
    } finally {
      setProvisioningAll(false);
    }
  };

  const handleOpenCompose = (opts?: { to?: string; subject?: string; text?: string; replyId?: string | null }) => {
    setReplyToMessageId(opts?.replyId || null);
    setToField(opts?.to || '');
    setSubjectField(opts?.subject || '');
    setTextField(opts?.text || '');
    setComposeOpen(true);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toField.trim() || !subjectField.trim() || !textField.trim()) {
      emitToast('Please fill out all email fields.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/agentmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inbox: activeInboxEmail,
          to: toField.trim(),
          subject: subjectField.trim(),
          text: textField.trim(),
          replyToMessageId: replyToMessageId || undefined,
        }),
      });

      if (res.ok) {
        emitToast(`Email sent from ${activeInboxEmail} to ${toField}`, 'success');
        setToField('');
        setSubjectField('');
        setTextField('');
        setReplyToMessageId(null);
        setComposeOpen(false);
        fetchInboxMessages(activeInboxEmail);
      } else {
        const err = await res.json().catch(() => ({}));
        emitToast(err?.details || err?.error || 'Failed to send email via AgentMail.', 'warning');
      }
    } catch {
      emitToast('Network error while sending email.', 'warning');
    } finally {
      setSending(false);
    }
  };

  const handleRunAiTriage = async (msg: AgentMailMessage) => {
    setTriagingId(msg.id);
    try {
      const res = await fetch('/api/email/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAddress: msg.from,
          toAddress: msg.to || activeInboxEmail,
          subject: msg.subject,
          body: msg.text || msg.snippet || '',
        }),
      });

      if (res.ok) {
        const result = (await res.json()) as TriageResult;
        setTriageResults((prev) => ({ ...prev, [msg.id]: result }));
        emitToast(`AI Triage completed: ${result.aiClassification}`, 'success');
      }
    } catch {
      emitToast('AI Triage execution failed.', 'warning');
    } finally {
      setTriagingId(null);
    }
  };

  const handleSendAiReply = async (msg: AgentMailMessage, triage: TriageResult) => {
    setSendingAiReplyId(msg.id);
    try {
      const replySubject = msg.subject.toLowerCase().startsWith('re:')
        ? msg.subject
        : `Re: ${msg.subject}`;
      const res = await fetch('/api/agentmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inbox: activeInboxEmail,
          to: msg.from,
          subject: replySubject,
          text: triage.replyBody,
          replyToMessageId: msg.id.startsWith('msg_mock_') ? undefined : msg.id,
        }),
      });
      if (res.ok) {
        emitToast(`AI reply dispatched from ${activeInboxEmail} to ${msg.from}`, 'success');
        fetchInboxMessages(activeInboxEmail);
      } else {
        const err = await res.json().catch(() => ({}));
        emitToast(err?.details || 'Failed to dispatch AI reply.', 'warning');
      }
    } finally {
      setSendingAiReplyId(null);
    }
  };

  const handleCopyAddress = (email: string) => {
    navigator.clipboard?.writeText(email).catch(() => {});
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 1600);
    emitToast(`Copied ${email}`, 'info');
  };

  const agentsWithoutAgentMailCount = nonEmergencyAgents.filter(
    (a) => !a.agentEmail.toLowerCase().endsWith('@agentmail.to')
  ).length;

  return (
    <div className="space-y-4">
      {/* Top Banner + Active Inbox Selector */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-sky-500/20">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display font-bold text-base text-zinc-950 dark:text-white">
                AgentMail Multi-Agent Hub
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                {configured
                  ? keyScope === 'inbox_scoped'
                    ? 'Live · exchagent@agentmail.to'
                    : `Live Org · ${inboxes.length} inbox${inboxes.length === 1 ? '' : 'es'}`
                  : 'Sandbox Mode'}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">Active Inbox:</span>
              <select
                value={activeInboxEmail}
                onChange={(e) => setActiveInboxEmail(e.target.value)}
                className="w-full sm:w-auto max-w-full min-w-0 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 py-1 text-xs font-mono font-semibold text-sky-700 dark:text-sky-400 focus:outline-none focus:border-sky-600"
              >
                {inboxes.map((ib) => (
                  <option key={ib.email} value={ib.email}>
                    {ib.email} {ib.display_name ? `(${ib.display_name})` : ''}
                  </option>
                ))}
                {!inboxes.some((i) => i.email.toLowerCase() === activeInboxEmail.toLowerCase()) && (
                  <option value={activeInboxEmail}>{activeInboxEmail}</option>
                )}
              </select>
              <button
                type="button"
                onClick={() => handleCopyAddress(activeInboxEmail)}
                className="w-7 h-7 rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                title="Copy inbox address"
              >
                {copiedEmail === activeInboxEmail ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              fetchInboxes();
              fetchInboxMessages(activeInboxEmail);
            }}
            disabled={loading}
            className="min-h-[38px] px-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Mail</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenCompose()}
            className="min-h-[38px] px-4 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-md transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Compose</span>
          </button>
        </div>
      </div>

      {/* AI Agent Email Provisioning Directory */}
      <div className="glass-panel rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display font-bold text-sm text-zinc-950 dark:text-white flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              AI Agent Email Roster (@agentmail.to)
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {keyScope === 'inbox_scoped'
                ? 'Active key is scoped to exchagent@agentmail.to — each AI agent gets a routed exchagent+<agent>@agentmail.to alias (with Reply-To preserved), or swap in an org-scoped key for standalone inboxes.'
                : 'Assign live routable @agentmail.to inboxes to your AI agents so external counterparties and partners can email them directly.'}
            </p>
          </div>
          {agentsWithoutAgentMailCount > 0 && (
            <button
              type="button"
              disabled={provisioningAll}
              onClick={handleProvisionAllAgents}
              className="min-h-[34px] px-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 disabled:opacity-60 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {provisioningAll
                  ? 'Provisioning...'
                  : `Give All Agents Email (${agentsWithoutAgentMailCount})`}
              </span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {nonEmergencyAgents.map((agent) => {
            const hasLiveAgentMail = agent.agentEmail.toLowerCase().endsWith('@agentmail.to');
            const isSelected = activeInboxEmail.toLowerCase() === agent.agentEmail.toLowerCase();
            const isBusy = provisioningHandle === agent.handle;
            return (
              <div
                key={agent.id}
                className={`rounded-xl p-2.5 border transition-colors flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-sky-500/10 border-sky-500/50'
                    : 'bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200 dark:border-white/10'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-display font-semibold text-xs text-zinc-950 dark:text-white truncate">
                      {agent.displayName}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-semibold shrink-0 ${
                        hasLiveAgentMail
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {hasLiveAgentMail ? 'Live Inbox' : 'Virtual'}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate mt-0.5">
                    {agent.agentEmail}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {hasLiveAgentMail ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveInboxEmail(agent.agentEmail)}
                        className="flex-1 min-h-[28px] rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-[11px] font-semibold px-2 hover:opacity-90"
                      >
                        {isSelected ? 'Viewing' : 'Open Inbox'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyAddress(agent.agentEmail)}
                        className="w-7 h-7 rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-400"
                        title="Copy agent email"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy || provisioningAll}
                      onClick={() => handleProvisionAgentInbox(agent)}
                      className="w-full min-h-[28px] rounded-lg bg-white dark:bg-zinc-900 border border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 text-[11px] font-semibold px-2 inline-flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{isBusy ? 'Minting...' : 'Give @agentmail.to'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Mailbox Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Message List */}
        <div className="lg:col-span-5 min-w-0 glass-panel rounded-2xl overflow-hidden flex flex-col h-[380px] lg:h-[500px]">
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between bg-zinc-50/75 dark:bg-zinc-900/40 shrink-0">
            <span className="font-display font-bold text-xs text-zinc-950 dark:text-white inline-flex items-center gap-1.5 truncate">
              <Inbox className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
              <span className="truncate">{activeInboxEmail} ({messages.length})</span>
            </span>
            <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 shrink-0">
              agentmail.to v0
            </span>
          </div>

          <SwipeScrollArea
            direction="vertical"
            showArrows={true}
            arrowSize="sm"
            className="flex-1 min-h-0"
            innerClassName="divide-y divide-zinc-200 dark:divide-white/[0.06]"
          >
            {messages.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
                <p>
                  No messages yet in {activeInboxEmail}
                  {typeof totalParentCount === 'number' && activeInboxEmail.includes('+')
                    ? ` (${totalParentCount} total in exchagent@agentmail.to)`
                    : '.'}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    handleOpenCompose({
                      to: 'exchagent@agentmail.to',
                      subject: `Hello from ${activeInboxEmail}`,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 text-[11px] font-semibold"
                >
                  <Send className="w-3 h-3" /> Send First Test Message
                </button>
              </div>
            ) : (
              messages.map((msg) => {
                const isSelected = selectedMsg?.id === msg.id;
                return (
                  <button
                    key={msg.id}
                    type="button"
                    onClick={() => handleSelectMessage(msg)}
                    className={`w-full p-3.5 text-left transition-colors flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-sky-500/10 border-l-4 border-sky-500 dark:bg-sky-500/15'
                        : 'hover:bg-zinc-100/75 dark:hover:bg-zinc-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="font-display font-semibold text-xs text-zinc-950 dark:text-white truncate">
                        {msg.from}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 shrink-0 tabular-nums">
                        {safeFormatTime(msg.timestamp)}
                      </span>
                    </div>
                    <p className="font-medium text-xs text-zinc-900 dark:text-zinc-200 truncate w-full">
                      {msg.subject}
                    </p>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-1 w-full">
                      {msg.snippet || msg.text}
                    </p>
                  </button>
                );
              })
            )}
          </SwipeScrollArea>
        </div>

        {/* Right: Selected Message Reader & AI Triage */}
        <div className="lg:col-span-7 min-w-0 glass-panel rounded-2xl p-4 sm:p-5 flex flex-col justify-between h-[440px] lg:h-[500px] overflow-hidden">
          {selectedMsg ? (
            <div className="space-y-4 flex-1 flex flex-col min-h-0">
              {/* Message Header */}
              <div className="pb-3 border-b border-zinc-200 dark:border-white/10 shrink-0 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setSelectedMsg(null)}
                      className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0"
                      aria-label="Back to Inbox list"
                      title="Back to Inbox"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <h3 className="font-display font-bold text-sm sm:text-base text-zinc-950 dark:text-white truncate">
                      {selectedMsg.subject}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenCompose({
                          to: selectedMsg.from,
                          subject: selectedMsg.subject.toLowerCase().startsWith('re:')
                            ? selectedMsg.subject
                            : `Re: ${selectedMsg.subject}`,
                          replyId: selectedMsg.id.startsWith('msg_mock_') ? null : selectedMsg.id,
                        })
                      }
                      className="min-h-[32px] px-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Reply className="w-3.5 h-3.5" />
                      <span>Reply</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRunAiTriage(selectedMsg)}
                      disabled={triagingId === selectedMsg.id}
                      className="min-h-[32px] px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{triagingId === selectedMsg.id ? 'Analyzing...' : 'AI Triage'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMsg(null)}
                      className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0"
                      aria-label="Close email reader"
                      title="Close"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-zinc-700 dark:text-zinc-300 font-mono truncate">
                    From: <strong className="text-zinc-950 dark:text-white">{selectedMsg.from}</strong> →{' '}
                    <span className="text-sky-700 dark:text-sky-400">{selectedMsg.to}</span>
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400 font-mono text-[11px] tabular-nums">
                    {safeFormatDateTime(selectedMsg.timestamp)}
                  </span>
                </div>
              </div>

              {/* Message Body Content */}
              <SwipeScrollArea
                direction="vertical"
                showArrows={true}
                arrowSize="sm"
                className="flex-1 min-h-0 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/10"
                innerClassName="p-3.5 font-mono text-xs text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap leading-relaxed"
              >
                {loadingMsgDetail
                  ? 'Loading full message...'
                  : selectedMsg.text || selectedMsg.snippet || 'No plain text body.'}
              </SwipeScrollArea>

              {/* AI Triage Result Box (if run) */}
              {triageResults[selectedMsg.id] && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 space-y-2 text-xs shrink-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Classification: {triageResults[selectedMsg.id].aiClassification}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums">
                      Proposed: {formatMoney(triageResults[selectedMsg.id].proposedPriceZAR || 0, currency)}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-90 font-sans">
                    <strong>Draft Reply:</strong> {triageResults[selectedMsg.id].replyBody}
                  </p>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={sendingAiReplyId === selectedMsg.id}
                      onClick={() => handleSendAiReply(selectedMsg, triageResults[selectedMsg.id])}
                      className="min-h-[30px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Send className="w-3 h-3" />
                      {sendingAiReplyId === selectedMsg.id ? 'Dispatching...' : 'Send AI Reply via AgentMail'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-600 dark:text-zinc-400 space-y-2">
              <Mail className="w-10 h-10 opacity-40" />
              <p className="text-xs">Select a message from the inbox to read details, reply, or run AI triage.</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose / Reply Modal */}
      {composeOpen && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/60 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setComposeOpen(false)}
        >
          <form
            onSubmit={handleSendEmail}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg glass-panel rounded-t-3xl sm:rounded-2xl max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="sm:hidden w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto mt-2 shrink-0" />
            <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-zinc-200 dark:border-white/10 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setComposeOpen(false)}
                  className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0"
                  aria-label="Back to Inbox"
                  title="Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h3 className="font-display font-bold text-sm sm:text-base text-zinc-950 dark:text-white inline-flex items-center gap-1.5 truncate">
                  <Send className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span className="truncate">
                    {replyToMessageId ? 'Reply from' : 'Compose from'} {activeInboxEmail}
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0"
                aria-label="Close Compose Modal"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <SwipeScrollArea
              direction="vertical"
              showArrows={true}
              arrowSize="sm"
              className="flex-1 min-h-0"
              innerClassName="p-4 sm:p-5 space-y-3 text-xs"
            >
              <div>
                <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">Recipient To:</label>
                <input
                  type="email"
                  required
                  value={toField}
                  onChange={(e) => setToField(e.target.value)}
                  placeholder="partner@company.com or agent@agentmail.to"
                  className="w-full min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-950 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">Subject:</label>
                <input
                  type="text"
                  required
                  value={subjectField}
                  onChange={(e) => setSubjectField(e.target.value)}
                  placeholder="A2A Negotiation & Settlement Proposal"
                  className="w-full min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-zinc-950 dark:text-white font-semibold"
                />
              </div>

              <div>
                <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">Message Body:</label>
                <textarea
                  required
                  rows={6}
                  value={textField}
                  onChange={(e) => setTextField(e.target.value)}
                  placeholder="Write your agent message or proposal here..."
                  className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 p-3 text-zinc-950 dark:text-white font-mono leading-relaxed"
                />
              </div>
            </SwipeScrollArea>

            <div className="flex items-center justify-end gap-2 px-4 sm:px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-zinc-200 dark:border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="min-h-[38px] px-4 rounded-xl border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="min-h-[38px] px-5 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 text-xs font-bold inline-flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sending ? 'Sending...' : replyToMessageId ? 'Send Reply' : 'Send Message'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
