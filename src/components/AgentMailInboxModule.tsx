import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Inbox,
  Send,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  User,
  ExternalLink,
  ChevronRight,
  Reply,
  Bot,
  AlertCircle,
} from 'lucide-react';
import { CurrencyMode, formatMoney } from '../types/firestore';
import { emitToast } from '../lib/toast';

interface AgentMailMessage {
  id: string;
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

interface AgentMailInboxModuleProps {
  currency: CurrencyMode;
  ownerUid: string;
}

export const AgentMailInboxModule: React.FC<AgentMailInboxModuleProps> = ({
  currency,
}) => {
  const [loading, setLoading] = useState(true);
  const [inboxEmail, setInboxEmail] = useState('exchagent@agentmail.to');
  const [configured, setConfigured] = useState(false);
  const [messages, setMessages] = useState<AgentMailMessage[]>([]);
  const [selectedMsg, setSelectedMsg] = useState<AgentMailMessage | null>(null);

  // Compose State
  const [composeOpen, setComposeOpen] = useState(false);
  const [toField, setToField] = useState('');
  const [subjectField, setSubjectField] = useState('');
  const [textField, setTextField] = useState('');
  const [sending, setSending] = useState(false);

  // AI Triage State
  const [triagingId, setTriagingId] = useState<string | null>(null);
  const [triageResults, setTriageResults] = useState<Record<string, any>>({});

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agentmail/inbox');
      if (res.ok) {
        const data = await res.json();
        setInboxEmail(data.inbox || 'exchagent@agentmail.to');
        setConfigured(Boolean(data.configured));
        setMessages(data.messages || []);
        if (data.messages?.length > 0 && !selectedMsg) {
          setSelectedMsg(data.messages[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to load AgentMail inbox:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMsg]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

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
          to: toField.trim(),
          subject: subjectField.trim(),
          text: textField.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        emitToast(`Email sent successfully to ${toField}`);
        setToField('');
        setSubjectField('');
        setTextField('');
        setComposeOpen(false);
        fetchInbox();
      } else {
        emitToast('Failed to send email via AgentMail.');
      }
    } catch (err) {
      emitToast('Network error while sending email.');
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
          toAddress: msg.to || inboxEmail,
          subject: msg.subject,
          body: msg.text || msg.snippet || '',
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setTriageResults((prev) => ({ ...prev, [msg.id]: result }));
        emitToast(`AI Triage completed: ${result.aiClassification}`);
      }
    } catch (err) {
      emitToast('AI Triage execution failed.');
    } finally {
      setTriagingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-sky-500/10 via-transparent to-purple-500/10 border border-sky-500/20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-base text-zinc-950 dark:text-white">
                AgentMail Inbox &amp; Autonomous Dispatch
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                {configured ? 'Active API' : 'Simulated Sandbox'}
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono mt-0.5">
              Primary Agent Address: <span className="text-sky-700 dark:text-sky-400 font-semibold">{inboxEmail}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={fetchInbox}
            disabled={loading}
            className="flex-1 sm:flex-none min-h-[38px] px-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Mail</span>
          </button>
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="flex-1 sm:flex-none min-h-[38px] px-4 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-md transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Compose</span>
          </button>
        </div>
      </div>

      {/* Main Mailbox Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Message List */}
        <div className="lg:col-span-5 glass-panel rounded-2xl overflow-hidden flex flex-col h-[520px]">
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between bg-zinc-50/75 dark:bg-zinc-900/40">
            <span className="font-display font-bold text-xs text-zinc-950 dark:text-white inline-flex items-center gap-1.5">
              <Inbox className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              Inbox Messages ({messages.length})
            </span>
            <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
              agentmail.to v0
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-200 dark:divide-white/[0.06] no-scrollbar">
            {messages.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-600 dark:text-zinc-400">
                No messages found in {inboxEmail}.
              </div>
            ) : (
              messages.map((msg) => {
                const isSelected = selectedMsg?.id === msg.id;
                return (
                  <div
                    key={msg.id}
                    onClick={() => setSelectedMsg(msg)}
                    className={`p-3.5 cursor-pointer text-left transition-colors flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-sky-500/10 border-l-4 border-sky-500 dark:bg-sky-500/15'
                        : 'hover:bg-zinc-100/75 dark:hover:bg-zinc-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-semibold text-xs text-zinc-950 dark:text-white truncate">
                        {msg.from}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 shrink-0">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="font-medium text-xs text-zinc-900 dark:text-zinc-200 truncate">
                      {msg.subject}
                    </p>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-1">
                      {msg.snippet || msg.text}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Selected Message Reader & AI Triage */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-4 sm:p-5 flex flex-col justify-between h-[520px] overflow-y-auto">
          {selectedMsg ? (
            <div className="space-y-4 flex-1 flex flex-col min-h-0">
              {/* Message Header */}
              <div className="pb-3 border-b border-zinc-200 dark:border-white/10 shrink-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display font-bold text-sm sm:text-base text-zinc-950 dark:text-white">
                    {selectedMsg.subject}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleRunAiTriage(selectedMsg)}
                    disabled={triagingId === selectedMsg.id}
                    className="min-h-[32px] px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{triagingId === selectedMsg.id ? 'Analyzing...' : 'Run Agent AI Triage'}</span>
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-zinc-700 dark:text-zinc-300 font-mono">
                    From: <strong className="text-zinc-950 dark:text-white">{selectedMsg.from}</strong>
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                    {new Date(selectedMsg.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Message Body Content */}
              <div className="flex-1 overflow-y-auto p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/10 font-mono text-xs text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap leading-relaxed">
                {selectedMsg.text || selectedMsg.snippet || 'No plain text body.'}
              </div>

              {/* AI Triage Result Box (if run) */}
              {triageResults[selectedMsg.id] && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 space-y-1 text-xs shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Classification: {triageResults[selectedMsg.id].aiClassification}
                    </span>
                    <span className="font-mono text-[10px]">
                      Proposed: R{(triageResults[selectedMsg.id].proposedPriceZAR || 0).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-90 font-sans">
                    <strong>Auto-Reply:</strong> {triageResults[selectedMsg.id].replyBody}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-600 dark:text-zinc-400 space-y-2">
              <Mail className="w-10 h-10 opacity-40" />
              <p className="text-xs">Select an email message from the inbox to read details and run agent triage.</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {composeOpen && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setComposeOpen(false)}
        >
          <form
            onSubmit={handleSendEmail}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg glass-panel rounded-2xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-white/10">
              <h3 className="font-display font-bold text-base text-zinc-950 dark:text-white inline-flex items-center gap-1.5">
                <Send className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Compose Agent Email ({inboxEmail})
              </h3>
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-700 dark:text-zinc-400 font-medium block mb-1">Recipient To:</label>
                <input
                  type="email"
                  required
                  value={toField}
                  onChange={(e) => setToField(e.target.value)}
                  placeholder="vendor@company.co.za"
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
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-white/10">
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
                <span>{sending ? 'Sending...' : 'Send Message'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
