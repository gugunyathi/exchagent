import React, { useState } from 'react';
import {
  Zap,
  ShieldCheck,
  Radio,
  CreditCard,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Terminal,
} from 'lucide-react';
import {
  AgentDoc,
  RfpDoc,
  NegotiationDoc,
  BookingDoc,
  CurrencyMode,
  PaymentRail,
  BroadcastChannel,
  ZAR_PER_USD,
  formatMoney,
} from '../types/firestore';
import { createX402Challenge } from '../services/paymentRails';
import { evaluateCalendarGuardrails } from '../services/calendarAgentTool';
import { SwipeScrollArea } from './SwipeScrollArea';
import { emitToast } from '../lib/toast';

interface NegotiationArenaModuleProps {
  agents: AgentDoc[];
  rfps: RfpDoc[];
  negotiations: NegotiationDoc[];
  selectedTargetAgent: AgentDoc | null;
  currency: CurrencyMode;
  ownerUid: string;
  onSaveNegotiation: (neg: NegotiationDoc) => Promise<void>;
  onSettleDeal: (params: {
    sessionId: string;
    buyerHandle: string;
    sellerHandle: string;
    channel: string;
    stickerPriceZAR: number;
    agreedPriceZAR: number;
    rail: PaymentRail;
  }) => Promise<unknown>;
  onPublishRfp: (rfp: RfpDoc) => Promise<void>;
  onAddBooking: (booking: BookingDoc) => Promise<void>;
}

export const NegotiationArenaModule: React.FC<NegotiationArenaModuleProps> = ({
  agents,
  rfps,
  negotiations,
  selectedTargetAgent,
  currency,
  ownerUid,
  onSaveNegotiation,
  onSettleDeal,
  onPublishRfp,
  onAddBooking,
}) => {
  const nonEmergencyAgents = agents.filter((a) => a.handle !== '911.emergency.agent');
  const [subTab, setSubTab] = useState<'arena' | 'rfp'>('arena');

  // A2A Arena State
  const [initiatorHandle, setInitiatorHandle] = useState(
    nonEmergencyAgents.find((a) => a.handle === 'alex.founder.agent')?.handle ||
      nonEmergencyAgents[0]?.handle ||
      ''
  );
  const [targetHandle, setTargetHandle] = useState(
    selectedTargetAgent?.handle ||
      nonEmergencyAgents.find((a) => a.handle === 'ceo.woolworths.agent')?.handle ||
      nonEmergencyAgents[1]?.handle ||
      ''
  );
  const [proposalTitle, setProposalTitle] = useState(
    'Zero-Emission Sandton Last-Mile EV & Cold-Chain Telemetry Suite'
  );
  const [stickerPriceZAR, setStickerPriceZAR] = useState(145000);
  const [selectedRail, setSelectedRail] = useState<PaymentRail>('paypal_vault');
  const [runningNeg, setRunningNeg] = useState(false);
  const [activeNegId, setActiveNegId] = useState<string>(negotiations[0]?.id || '');
  const [x402StatusBanner, setX402StatusBanner] = useState<string | null>(null);

  // Reverse-RFP State
  const [rfpTitle, setRfpTitle] = useState('Solar Smart Inverter Fleet for Randburg Retail Strip');
  const [rfpDesc, setRfpDesc] = useState(
    'Require 12 hybrid 15kVA smart inverters with automated telemetry and x402 milestone payouts.'
  );
  const [rfpBudgetZAR, setRfpBudgetZAR] = useState(210000);
  const [rfpCategory, setRfpCategory] = useState('Clean Energy & Telecom');
  const [rfpChannels, setRfpChannels] = useState<BroadcastChannel[]>([
    'directory',
    'google_maps_billboard',
    'ble_beacon',
    'carplay',
  ]);
  const [broadcasting, setBroadcasting] = useState(false);
  const [rfpProposals, setRfpProposals] = useState<
    Array<{ vendorHandle: string; bidZAR: number; matchScore: number; pitchSummary: string }>
  >([]);

  React.useEffect(() => {
    if (selectedTargetAgent && selectedTargetAgent.handle !== '911.emergency.agent') {
      setTargetHandle(selectedTargetAgent.handle);
      setSubTab('arena');
    }
  }, [selectedTargetAgent]);

  const activeNeg = negotiations.find((n) => n.id === activeNegId) || negotiations[0] || null;

  const handleRunNegotiation = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = agents.find((a) => a.handle === targetHandle);
    const initiator = agents.find((a) => a.handle === initiatorHandle);
    if (!target || !initiator) return;

    setRunningNeg(true);
    setX402StatusBanner(null);

    try {
      const res = await fetch('/api/a2a/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initiatorHandle: initiator.handle,
          targetHandle: target.handle,
          proposalTitle,
          stickerPriceZAR: Number(stickerPriceZAR),
          surface: 'desktop',
          targetMaxSpendZAR: target.guardrails.maxAutoSpendZAR,
          targetMinDiscountPct: target.guardrails.minDiscountPct,
        }),
      });
      const data = await res.json();

      const sessionId = `neg_${Date.now()}`;
      const newNeg: NegotiationDoc = {
        id: sessionId,
        initiatorAgentId: initiator.id,
        initiatorOwnerUid: ownerUid,
        targetAgentId: target.id,
        targetOwnerUid: target.ownerUid,
        initiatorHandle: initiator.handle,
        targetHandle: target.handle,
        surface: 'desktop',
        status: data.finalStatus || 'OFFER_ACCEPTED',
        stickerPriceZAR: Number(stickerPriceZAR),
        currentOfferZAR: data.agreedPriceZAR,
        agreedPriceZAR: data.finalStatus === 'OFFER_ACCEPTED' ? data.agreedPriceZAR : undefined,
        messages: data.messages || [],
        popiaAuditHash: data.popiaAuditHash || 'popia_sha256_verified',
        updatedAt: new Date().toISOString(),
      };

      await onSaveNegotiation(newNeg);
      setActiveNegId(sessionId);

      if (newNeg.status === 'OFFER_ACCEPTED' && newNeg.agreedPriceZAR) {
        const calCheck = evaluateCalendarGuardrails(target, newNeg.agreedPriceZAR);
        if (calCheck.guardrailCheckPassed) {
          await onAddBooking({
            id: `book_${Date.now()}`,
            sessionId,
            organizerAgentId: initiator.id,
            organizerHandle: initiator.handle,
            attendeeAgentId: target.id,
            attendeeHandle: target.handle,
            ownerUid,
            title: data.calendarMeetingTitle || `${proposalTitle} — SLA Kickoff`,
            startTime: calCheck.suggestedStartISO,
            endTime: calCheck.suggestedEndISO,
            meetLink: `https://meet.google.com/swb-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`,
            dealValueZAR: newNeg.agreedPriceZAR,
            googleSynced: false,
            status: 'CONFIRMED',
          });
        }
        emitToast(`Deal accepted at ${formatMoney(newNeg.agreedPriceZAR, currency)}`, 'success');
      } else {
        emitToast('Negotiation escalated — margin guardrail triggered', 'warning');
      }
    } finally {
      setRunningNeg(false);
    }
  };

  const handleTriggerSettlement = async () => {
    if (!activeNeg || !activeNeg.agreedPriceZAR) return;
    if (selectedRail.startsWith('x402_')) {
      const challenge = createX402Challenge(activeNeg.agreedPriceZAR, selectedRail);
      setX402StatusBanner(
        `402 Challenge ${challenge.nonce} -> ${challenge.payToAddress} ($${challenge.amountUSD} USDC)`
      );
      await new Promise((r) => setTimeout(r, 400));
    }
    await onSettleDeal({
      sessionId: activeNeg.id,
      buyerHandle: activeNeg.targetHandle,
      sellerHandle: activeNeg.initiatorHandle,
      channel: 'A2A Arena',
      stickerPriceZAR: activeNeg.stickerPriceZAR,
      agreedPriceZAR: activeNeg.agreedPriceZAR,
      rail: selectedRail,
    });
    emitToast(
      `Settled ${formatMoney(activeNeg.agreedPriceZAR, currency)} via ${selectedRail.toUpperCase()}`,
      'success'
    );
  };

  const handleBroadcastRfp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcasting(true);
    try {
      const publisher = nonEmergencyAgents[0];
      const rfp: RfpDoc = {
        id: `rfp_${Date.now()}`,
        publisherAgentId: publisher?.id || 'agent_alex_founder',
        publisherOwnerUid: ownerUid,
        publisherHandle: publisher?.handle || 'alex.founder.agent',
        title: rfpTitle,
        description: rfpDesc,
        budgetZAR: Number(rfpBudgetZAR),
        budgetUSD: Number((Number(rfpBudgetZAR) / ZAR_PER_USD).toFixed(2)),
        category: rfpCategory,
        broadcastChannels: rfpChannels,
        location: {
          lat: -26.0594,
          lng: 27.9583,
          billboardName: 'Sandton / William Nicol Live Corridor',
          radiusMeters: 600,
        },
        status: 'OPEN',
        expiresAt: new Date(Date.now() + 14 * 86400000).toISOString(),
        matchedProposalsCount: 3,
      };
      await onPublishRfp(rfp);

      const res = await fetch('/api/rfp/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: rfpTitle,
          description: rfpDesc,
          budgetZAR: Number(rfpBudgetZAR),
          category: rfpCategory,
          broadcastChannels: rfpChannels,
        }),
      });
      const data = await res.json();
      setRfpProposals(data.proposals || []);
      emitToast(`Reverse-RFP broadcast across ${rfpChannels.length} channels`, 'success');
    } finally {
      setBroadcasting(false);
    }
  };

  const toggleChannel = (ch: BroadcastChannel) => {
    setRfpChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const activeSavingsPct =
    activeNeg && activeNeg.stickerPriceZAR > 0
      ? Math.round(
          ((activeNeg.stickerPriceZAR - (activeNeg.agreedPriceZAR || activeNeg.currentOfferZAR)) /
            activeNeg.stickerPriceZAR) *
            100
        )
      : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-display font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
            Negotiation Arena
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Autonomous A2A deal threads &amp; ambient Reverse-RFP broadcasts
          </p>
        </div>

        <SwipeScrollArea
          direction="horizontal"
          innerClassName="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10"
        >
          <button
            type="button"
            onClick={() => setSubTab('arena')}
            className={`min-h-[36px] px-3.5 rounded-lg text-xs transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'arena'
                ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 font-medium'
            }`}
          >
            Bilateral A2A
          </button>
          <button
            type="button"
            onClick={() => setSubTab('rfp')}
            className={`min-h-[36px] px-3.5 rounded-lg text-xs transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'rfp'
                ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 font-medium'
            }`}
          >
            Reverse-RFP ({rfps.length})
          </button>
        </SwipeScrollArea>
      </div>

      {subTab === 'arena' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Pane: Compact Pitch Composer & Recent Threads */}
          <form onSubmit={handleRunNegotiation} className="lg:col-span-4 glass-panel rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50">New A2A Pitch</h3>

            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              From
              <select
                value={initiatorHandle}
                onChange={(e) => setInitiatorHandle(e.target.value)}
                className="mt-1 w-full min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
              >
                {nonEmergencyAgents.map((a) => (
                  <option key={a.id} value={a.handle}>
                    {a.handle} ({a.organization})
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              To
              <select
                value={targetHandle}
                onChange={(e) => setTargetHandle(e.target.value)}
                className="mt-1 w-full min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
              >
                {nonEmergencyAgents.map((a) => (
                  <option key={a.id} value={a.handle}>
                    {a.handle} · Cap {formatMoney(a.guardrails.maxAutoSpendZAR, currency)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Proposal
              <textarea
                rows={2}
                value={proposalTitle}
                onChange={(e) => setProposalTitle(e.target.value)}
                className="mt-1 w-full rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-950 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
              />
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Sticker (ZAR)
                <input
                  type="number"
                  min={500}
                  value={stickerPriceZAR}
                  onChange={(e) => setStickerPriceZAR(Number(e.target.value))}
                  className="mt-1 w-full min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs font-mono tabular-nums text-zinc-950 dark:text-white focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
                />
              </label>
              <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                <span>USD Equiv</span>
                <div className="mt-1 w-full min-h-[38px] rounded-xl bg-zinc-100 dark:bg-zinc-950/60 border border-zinc-300 dark:border-white/10 px-3 flex items-center text-xs font-mono tabular-nums text-zinc-800 dark:text-zinc-300">
                  ${(stickerPriceZAR / ZAR_PER_USD).toFixed(2)}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={runningNeg}
              className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-950 dark:bg-zinc-50 px-4 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              {runningNeg ? 'Negotiating...' : 'Run A2A Pitch'}
            </button>

            <div className="pt-3 border-t border-zinc-200 dark:border-white/10">
              <p className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-2">Recent Threads</p>
              <SwipeScrollArea direction="vertical" className="max-h-40" innerClassName="space-y-1">
                {negotiations.map((neg) => (
                  <button
                    key={neg.id}
                    type="button"
                    onClick={() => setActiveNegId(neg.id)}
                    className={`w-full min-h-[36px] text-left rounded-lg px-2.5 py-1.5 text-xs transition-colors flex items-center justify-between border ${
                      activeNeg?.id === neg.id
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 border-zinc-400 dark:border-white/20 font-medium'
                        : 'bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-400 hover:border-zinc-300 dark:hover:text-zinc-200'
                    }`}
                  >
                    <span className="font-mono text-[11px] truncate">
                      {neg.initiatorHandle.replace('.agent', '')} → {neg.targetHandle.replace('.agent', '')}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums font-semibold text-emerald-700 dark:text-emerald-300 shrink-0 ml-2">
                      {neg.status}
                    </span>
                  </button>
                ))}
              </SwipeScrollArea>
            </div>
          </form>

          {/* Right Pane: Split Chat Stream & Settlement Bar */}
          <div className="lg:col-span-8 glass-panel rounded-2xl p-4 sm:p-5 space-y-4">
            {runningNeg ? (
              <div className="space-y-3 py-6">
                <div className="skeleton-line h-4 w-1/3" />
                <div className="skeleton-line h-16 w-4/5" />
                <div className="skeleton-line h-16 w-4/5 ml-auto" />
                <div className="skeleton-line h-14 w-3/4" />
              </div>
            ) : activeNeg ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-white/10">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-mono font-medium text-zinc-900 dark:text-zinc-200 truncate">{activeNeg.initiatorHandle}</span>
                      <span className="text-zinc-500">→</span>
                      <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300 truncate">{activeNeg.targetHandle}</span>
                    </div>
                    <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                      Audit: {activeNeg.popiaAuditHash}
                    </p>
                  </div>

                  <div className="sm:text-right shrink-0">
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      Sticker → Agreed {activeSavingsPct > 0 ? `(−${activeSavingsPct}%)` : ''}
                    </p>
                    <p className="text-sm font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                      {formatMoney(activeNeg.stickerPriceZAR, currency)} →{' '}
                      <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                        {formatMoney(activeNeg.agreedPriceZAR || activeNeg.currentOfferZAR, currency)}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Buyer / Seller Turn Bubbles */}
                <div className="space-y-2.5">
                  {activeNeg.messages.map((msg, idx) => {
                    const isSeller = msg.senderRole === 'seller';
                    return (
                      <div
                        key={idx}
                        className={`rounded-xl p-3.5 border max-w-[92%] ${
                          isSeller
                            ? 'bg-zinc-50 dark:bg-zinc-950 border-zinc-300 dark:border-white/10 mr-auto'
                            : 'bg-sky-50/70 dark:bg-zinc-900/90 border-sky-200 dark:border-white/15 ml-auto'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-200 truncate">
                              {msg.sender}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-white/10 text-[10px] font-mono text-zinc-700 dark:text-zinc-300 uppercase shrink-0">
                              {msg.type}
                            </span>
                          </div>
                          <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                            {formatMoney(msg.priceZAR, currency)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs sm:text-[13px] text-zinc-800 dark:text-zinc-300 leading-relaxed">
                          {msg.rationale}
                        </p>
                        {msg.toolCall && (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 px-2 py-0.5 text-[11px] font-mono text-sky-700 dark:text-sky-400 max-w-full truncate">
                            <Terminal className="w-3 h-3 shrink-0" />
                            <span className="truncate">{msg.toolCall}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Settlement Bar */}
                {activeNeg.status === 'OFFER_ACCEPTED' && (
                  <div className="pt-3.5 border-t border-zinc-200 dark:border-white/10 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4" />
                        Guardrails Satisfied
                      </span>
                      <span className="font-mono text-zinc-600 dark:text-zinc-400 inline-flex items-center gap-1">
                        <CalendarCheck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        Kickoff Auto-Booked
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(
                        [
                          { id: 'paypal_vault', label: 'PayPal Vault' },
                          { id: 'x402_base', label: 'x402 Base' },
                          { id: 'x402_arc', label: 'x402 Arc' },
                          { id: 'x402_solana', label: 'x402 Solana' },
                        ] as const
                      ).map((rail) => (
                        <button
                          key={rail.id}
                          type="button"
                          onClick={() => setSelectedRail(rail.id)}
                          className={`min-h-[36px] px-3 rounded-lg text-xs border transition-colors whitespace-nowrap ${
                            selectedRail === rail.id
                              ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-white font-semibold'
                              : 'bg-white dark:bg-zinc-950 border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-white/25 font-medium'
                          }`}
                        >
                          {rail.label}
                        </button>
                      ))}
                    </div>

                    {x402StatusBanner && (
                      <div className="rounded-lg bg-amber-50 dark:bg-zinc-950 border border-amber-300 dark:border-amber-400/30 p-2.5 text-[11px] font-mono text-amber-800 dark:text-amber-300">
                        {x402StatusBanner}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleTriggerSettlement}
                      className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-400 dark:hover:bg-emerald-300 px-4 text-xs font-semibold text-white dark:text-zinc-950 transition-colors"
                    >
                      <CreditCard className="w-4 h-4" />
                      Settle Deal ({formatMoney(activeNeg.agreedPriceZAR || 0, currency)})
                    </button>
                  </div>
                )}

                {activeNeg.status === 'SETTLED' && (
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-400/25 p-3.5 flex items-center gap-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>Settled and recorded in the Audit Ledger.</span>
                  </div>
                )}

                {activeNeg.status === 'REJECTED' && (
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-400/25 p-3.5 flex items-center gap-2.5 text-xs font-medium text-rose-800 dark:text-rose-200">
                    <XCircle className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0" />
                    <span>Rejected by margin/spend guardrails. Escalated to owner.</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-zinc-600 dark:text-zinc-400 py-8 text-center">
                Launch a pitch to stream live A2A negotiation turns.
              </p>
            )}
          </div>
        </div>
      ) : (
        /* Reverse-RFP Tab */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <form onSubmit={handleBroadcastRfp} className="lg:col-span-5 glass-panel rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50">Broadcast Reverse-RFP</h3>

            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              RFP Title
              <input
                type="text"
                required
                value={rfpTitle}
                onChange={(e) => setRfpTitle(e.target.value)}
                className="mt-1 w-full min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
              />
            </label>

            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Requirements
              <textarea
                rows={3}
                value={rfpDesc}
                onChange={(e) => setRfpDesc(e.target.value)}
                className="mt-1 w-full rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-950 dark:text-zinc-200 focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
              />
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Budget (ZAR)
                <input
                  type="number"
                  value={rfpBudgetZAR}
                  onChange={(e) => setRfpBudgetZAR(Number(e.target.value))}
                  className="mt-1 w-full min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs font-mono tabular-nums text-zinc-950 dark:text-white focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Category
                <input
                  type="text"
                  value={rfpCategory}
                  onChange={(e) => setRfpCategory(e.target.value)}
                  className="mt-1 w-full min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs text-zinc-950 dark:text-zinc-200 focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
                />
              </label>
            </div>

            <div>
              <span className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Channels</span>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'directory', label: 'Directory' },
                    { id: 'google_maps_billboard', label: 'DOOH Billboards' },
                    { id: 'ble_beacon', label: 'BLE 50m Mesh' },
                    { id: 'carplay', label: 'CarPlay / Auto' },
                  ] as const
                ).map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggleChannel(ch.id)}
                    className={`min-h-[36px] px-3 rounded-lg text-xs border text-left transition-colors ${
                      rfpChannels.includes(ch.id)
                        ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-white font-semibold'
                        : 'bg-white dark:bg-zinc-950 border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-400 hover:border-zinc-400 font-medium'
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={broadcasting}
              className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-950 dark:bg-zinc-50 px-4 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 transition-colors"
            >
              <Radio className="w-3.5 h-3.5" />
              {broadcasting ? 'Broadcasting...' : 'Publish Reverse-RFP'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-4">
            {rfpProposals.length > 0 && (
              <div className="glass-panel rounded-2xl p-4 border-emerald-400 dark:border-emerald-400/25 space-y-2.5">
                <h4 className="text-xs font-display font-bold text-emerald-700 dark:text-emerald-300">Auto-Matched Vendor Bids</h4>
                <div className="space-y-2">
                  {rfpProposals.map((p, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <p className="text-xs font-mono text-zinc-900 dark:text-zinc-200">
                          {p.vendorHandle} · <span className="text-emerald-700 dark:text-emerald-300 font-semibold">{p.matchScore}% match</span>
                        </p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{p.pitchSummary}</p>
                      </div>
                      <span className="font-mono tabular-nums text-xs font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                        {formatMoney(p.bidZAR, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="glass-panel rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50">Active Reverse-RFPs</h3>
              <div className="space-y-2.5">
                {rfps.map((rfp) => (
                  <div key={rfp.id} className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono text-zinc-600 dark:text-zinc-400 truncate">{rfp.publisherHandle}</span>
                      <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">{rfp.status}</span>
                    </div>
                    <h4 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-100">{rfp.title}</h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">{rfp.description}</p>
                    <div className="pt-2 flex items-center justify-between gap-2 text-xs border-t border-zinc-200 dark:border-white/10">
                      <span className="text-zinc-600 dark:text-zinc-400 truncate">{rfp.broadcastChannels.join(' · ')}</span>
                      <span className="font-mono tabular-nums font-semibold text-zinc-950 dark:text-zinc-100 shrink-0">
                        {formatMoney(rfp.budgetZAR, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
